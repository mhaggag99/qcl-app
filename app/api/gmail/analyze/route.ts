import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/googleAuth";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface GmailPart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function extractText(part: GmailPart): string {
  if (part.body?.data) {
    const text = Buffer.from(part.body.data, "base64url").toString("utf-8");
    if (part.mimeType === "text/html") {
      return text.replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    return text;
  }
  if (part.parts) {
    for (const p of part.parts) {
      if (p.mimeType === "text/plain") { const t = extractText(p); if (t) return t; }
    }
    for (const p of part.parts) {
      if (p.mimeType === "text/html") { const t = extractText(p); if (t) return t; }
    }
    for (const p of part.parts) {
      const t = extractText(p); if (t) return t;
    }
  }
  return "";
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidAccessToken(session.userId);
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const { threadIds } = await req.json() as { threadIds: string[] };
  if (!threadIds?.length) return NextResponse.json({ threads: [] });

  const results = await Promise.all(
    threadIds.slice(0, 5).map(async (threadId) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!res.ok) return null;
      const data = await res.json();

      const messages = ((data.messages || []) as { payload: GmailPart; internalDate: string }[]).map((msg) => {
        const headers = (msg.payload as { headers?: { name: string; value: string }[] }).headers || [];
        const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
        const body = extractText(msg.payload).slice(0, 2500);
        return { from: get("From"), date: get("Date"), body };
      });

      const firstHeaders = ((data.messages?.[0] as { payload: { headers?: { name: string; value: string }[] } })?.payload?.headers || []) as { name: string; value: string }[];
      const subject = firstHeaders.find((h) => h.name === "Subject")?.value || "(no subject)";

      return { subject, messages };
    })
  );

  return NextResponse.json({ threads: results.filter(Boolean) });
}
