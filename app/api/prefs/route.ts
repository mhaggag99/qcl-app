import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, deleteSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

const PREF_PREFIX = "pref_";

export async function GET() {
  // We store prefs as JSON blob in one settings key for easy retrieval
  const raw = getSetting(PREF_PREFIX + "all");
  const prefs: Record<string, string> = raw ? JSON.parse(raw) : {};
  return NextResponse.json(prefs);
}

export async function POST(req: NextRequest) {
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
  // Also clean up legacy individual keys if any
  deleteSetting(PREF_PREFIX + key);

  return NextResponse.json({ ok: true, prefs });
}
