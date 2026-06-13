import { NextRequest, NextResponse } from "next/server";
import { isConnected } from "@/lib/googleAuth";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ connected: isConnected(session.userId) });
}
