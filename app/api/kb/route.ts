import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ text: getSetting("kb_rules") || "" });
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  setSetting("kb_rules", String(text || ""));
  return NextResponse.json({ ok: true });
}
