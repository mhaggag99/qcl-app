import { NextResponse } from "next/server";
import { getRoundtableStatus } from "@/lib/monday";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getRoundtableStatus();
    if (!data) return NextResponse.json({ error: "Client Roundtable Status board not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
