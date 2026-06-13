import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

const API = "https://api.monday.com/v2";

async function gql(query: string, token: string) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mondayApiToken } = getUserSettings(session.userId);
  if (!mondayApiToken) return NextResponse.json({ error: "monday_not_configured" }, { status: 422 });

  try {
    const data = await gql(`{
      updates (limit: 100) {
        id
        body
        created_at
        creator { name }
        item_id
      }
    }`, mondayApiToken);

    if (data?.errors) {
      return NextResponse.json({ error: data.errors[0]?.message || "Monday API error" }, { status: 502 });
    }

    const updates: { id: string; body: string; created_at: string; creator: { name: string }; item_id: string }[] =
      data?.data?.updates || [];

    const seenSet = new Set(db.getSeenNotifications(session.userId));

    const mentions = updates.filter(
      (u) =>
        !seenSet.has(u.id) &&
        u.body?.toLowerCase().includes("marwan haggag")
    );

    return NextResponse.json(mentions.map((u) => ({
      id: u.id,
      text: u.body.replace(/<[^>]*>/g, "").trim(),
      created_at: u.created_at,
      creator: u.creator?.name || "",
      item_id: u.item_id,
    })));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { notificationId, text, addAsTask } = await req.json();
    if (!notificationId) return NextResponse.json({ error: "notificationId required" }, { status: 400 });

    db.markNotificationSeen(notificationId, session.userId);

    if (addAsTask && text?.trim()) {
      db.createTask({ text: text.trim(), dueDate: "", priority: "normal" }, session.userId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
