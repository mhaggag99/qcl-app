import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(db.getActivityLogs(session.userId));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await req.json();
    const result = db.createActivityLog({
      date: data.date,
      va: data.va,
      clientId: data.clientId,
      clientName: data.clientName,
      pmName: data.pmName || "",
      connReqSent: parseInt(data.connReqSent) || 0,
      inmailsSent: parseInt(data.inmailsSent) || 0,
      liEventInvites: parseInt(data.liEventInvites) || 0,
      interested: parseInt(data.interested) || 0,
      registeredErt: parseInt(data.registeredErt) || 0,
    }, session.userId);
    if ("duplicate" in result) {
      return NextResponse.json({ error: "Already submitted for this client today." }, { status: 409 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
