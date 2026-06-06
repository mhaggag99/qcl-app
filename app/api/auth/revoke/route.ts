import { NextResponse } from "next/server";
import { getSetting, deleteSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const accessToken = getSetting("google_access_token");
  if (accessToken) {
    // Best-effort revoke with Google
    fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, { method: "POST" }).catch(() => {});
  }
  deleteSetting("google_access_token");
  deleteSetting("google_refresh_token");
  deleteSetting("google_token_expiry");
  return NextResponse.json({ ok: true });
}
