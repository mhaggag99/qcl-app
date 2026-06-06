import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

export interface GmailThread {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  messageCount: number;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  if (!q.trim()) return NextResponse.json({ threads: [] });

  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const maxResults = Math.min(parseInt(request.nextUrl.searchParams.get("maxResults") || "8"), 20);

  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(q)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );

  if (!searchRes.ok) {
    const errBody = await searchRes.json().catch(() => ({}));
    const googleMsg: string = (errBody as { error?: { message?: string } })?.error?.message || "";
    const status = searchRes.status;
    const isApiDisabled = googleMsg.toLowerCase().includes("disabled") || googleMsg.toLowerCase().includes("has not been used");
    return NextResponse.json(
      { error: status === 403 ? "Gmail not authorized" : "Gmail API error", googleMessage: googleMsg, isApiDisabled },
      { status }
    );
  }

  const searchData = await searchRes.json();
  const threadIds: string[] = ((searchData.threads || []) as { id: string }[])
    .slice(0, maxResults)
    .map((t) => t.id);

  if (!threadIds.length) return NextResponse.json({ threads: [] });

  const threads = await Promise.all(
    threadIds.map(async (id) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const msgs = (data.messages || []) as { payload: { headers: { name: string; value: string }[] }; snippet: string }[];
      const last = msgs[msgs.length - 1];
      const headers = last?.payload?.headers || [];
      const get = (name: string) => headers.find((h) => h.name === name)?.value || "";
      return {
        id,
        subject: get("Subject") || "(no subject)",
        from: get("From"),
        date: get("Date"),
        snippet: last?.snippet || "",
        messageCount: msgs.length,
      } as GmailThread;
    })
  );

  return NextResponse.json({ threads: threads.filter(Boolean) });
}
