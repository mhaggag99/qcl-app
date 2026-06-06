import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(db.getMeetingDraft());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    db.saveMeetingDraft(body);
    return NextResponse.json(db.getMeetingDraft());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
