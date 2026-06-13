import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUserSettings, saveUserSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = getUserSettings(session.userId);
  if (settings.googleAccessToken) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${settings.googleAccessToken}`, { method: "POST" }).catch(() => {});
  }
  saveUserSettings(session.userId, { googleAccessToken: "", googleRefreshToken: "", googleTokenExpiry: "" });
  return NextResponse.json({ ok: true });
}
