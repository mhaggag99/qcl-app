import { NextResponse } from "next/server";
import { getMonthlyActivity } from "@/lib/monday";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getMonthlyActivity();
    if (!data) return NextResponse.json({ error: "Activity board not found for this month" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
