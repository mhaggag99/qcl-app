import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/googleAuth";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to, subject, body } = await request.json();

  const token = await getValidAccessToken(session.userId);
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const raw = [
    `To: ${to || ""}`,
    `Subject: ${subject || ""}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body || "",
  ].join("\r\n");

  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err.error?.message || "Failed to send" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ ok: true, messageId: data.id });
}
