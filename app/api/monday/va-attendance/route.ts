import { NextResponse } from "next/server";
import { getVAAttendance } from "@/lib/monday";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await getVAAttendance();
    return NextResponse.json(entries);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
