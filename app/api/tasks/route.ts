import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(db.getAllTasks());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text, dueDate, priority } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
    const task = db.createTask({ text: text.trim(), dueDate, priority });
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
