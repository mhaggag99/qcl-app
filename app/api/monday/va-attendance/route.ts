import { NextRequest, NextResponse } from "next/server";
import { getVAAttendance } from "@/lib/monday";
import { getSessionUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mondayApiToken } = getUserSettings(session.userId);
  if (!mondayApiToken) return NextResponse.json({ error: "monday_not_configured" }, { status: 422 });

  try {
    const entries = await getVAAttendance(mondayApiToken);
    return NextResponse.json(entries);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
