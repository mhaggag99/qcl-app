import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUserSettings, saveUserSettings } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = getUserSettings(session.userId);
  // Never expose full tokens to the client — just signal whether they're set
  return NextResponse.json({
    mondayConfigured: !!settings.mondayApiToken,
    googleConnected: !!settings.googleAccessToken,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const patch: Parameters<typeof saveUserSettings>[1] = {};
  if (typeof body.mondayApiToken === "string") patch.mondayApiToken = body.mondayApiToken.trim();

  saveUserSettings(session.userId, patch);
  return NextResponse.json({ ok: true });
}
