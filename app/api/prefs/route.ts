import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, deleteSetting } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PREF_PREFIX = "pref_";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = getSetting(PREF_PREFIX + "all");
  const prefs: Record<string, string> = raw ? JSON.parse(raw) : {};
  return NextResponse.json(prefs);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, value } = await req.json();
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const raw = getSetting(PREF_PREFIX + "all");
  const prefs: Record<string, string> = raw ? JSON.parse(raw) : {};

  if (value === null || value === undefined || value === "") {
    delete prefs[key];
  } else {
    prefs[key] = String(value);
  }

  setSetting(PREF_PREFIX + "all", JSON.stringify(prefs));
  deleteSetting(PREF_PREFIX + key);

  return NextResponse.json({ ok: true, prefs });
}
