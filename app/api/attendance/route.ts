import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(db.getAllAttendance());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const entry = db.createAttendance(data);
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}