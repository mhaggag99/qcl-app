import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAllUsers } from "@/lib/db";
import Database from "better-sqlite3";
import path from "path";

function getDb() {
  const db = new Database(path.join(process.cwd(), "data", "qcl.db"));
  db.pragma("journal_mode = WAL");
  return db;
}

function importTable(
  db: Database.Database,
  table: string,
  rows: Record<string, unknown>[],
  ownerId: string
): number {
  if (!rows?.length) return 0;
  const processed = rows.map((r) => ({ ...r, user_id: ownerId }));
  const cols = Object.keys(processed[0]);
  const placeholders = cols.map(() => "?").join(", ");
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`
  );
  const insertAll = db.transaction((items: Record<string, unknown>[]) => {
    for (const item of items) stmt.run(...Object.values(item));
  });
  insertAll(processed);
  return processed.length;
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Find the owner account on this server
  const users = getAllUsers();
  const owner = users.find((u) => u.role === "owner");
  if (!owner) {
    return NextResponse.json({ error: "No owner account found on this server. Register as owner first." }, { status: 400 });
  }

  const db = getDb();

  try {
    const stats = {
      clients:     importTable(db, "clients",      body.clients     ?? [], owner.id),
      tasks:       importTable(db, "tasks",         body.tasks       ?? [], owner.id),
      attendance:  importTable(db, "attendance",    body.attendance  ?? [], owner.id),
      activityLog: importTable(db, "activity_log",  body.activityLog ?? [], owner.id),
      mondaySeen:  importTable(db, "monday_seen",   body.mondaySeen  ?? [], owner.id),
    };

    // Meeting draft — single row upsert
    if (body.meetingDraft) {
      const d = { ...body.meetingDraft, user_id: owner.id };
      const cols = Object.keys(d);
      const placeholders = cols.map(() => "?").join(", ");
      db.prepare(
        `INSERT OR REPLACE INTO meeting_draft_v2 (${cols.join(", ")}) VALUES (${placeholders})`
      ).run(...Object.values(d));
    }

    // User settings — single row upsert (monday token, google tokens)
    if (body.userSettings) {
      const s = { ...body.userSettings, user_id: owner.id };
      const cols = Object.keys(s);
      const placeholders = cols.map(() => "?").join(", ");
      db.prepare(
        `INSERT OR REPLACE INTO user_settings (${cols.join(", ")}) VALUES (${placeholders})`
      ).run(...Object.values(s));
    }

    return NextResponse.json({ ok: true, stats, ownerEmail: owner.email });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
