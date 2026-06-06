import { NextResponse } from "next/server";
import { isConnected } from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ connected: isConnected() });
}
