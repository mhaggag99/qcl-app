import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(db.getTasks(session.userId));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { text, dueDate, priority } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
    const task = db.createTask({ text: text.trim(), dueDate, priority }, session.userId);
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
