import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { to, subject, body } = await request.json();

  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  // Build RFC 2822 message
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

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw: encoded } }),
  });

  if (res.status === 403) return NextResponse.json({ error: "Gmail not authorized" }, { status: 403 });
  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err.error?.message || "Failed to create draft" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ ok: true, draftId: data.id });
}
