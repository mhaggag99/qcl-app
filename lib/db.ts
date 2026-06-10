import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Client, AttendanceEntry, Note, Task, MeetingDraft, ActivityLog } from "@/types";
import { uid } from "./utils";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "qcl.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      va TEXT DEFAULT '',
      start TEXT DEFAULT '',
      status TEXT DEFAULT 'New Client',
      li TEXT DEFAULT '',
      ert TEXT DEFAULT '',
      ert_time TEXT DEFAULT '',
      attendees INTEGER DEFAULT 0,
      registered INTEGER DEFAULT 0,
      message TEXT DEFAULT '',
      targeting TEXT DEFAULT '',
      flag TEXT DEFAULT '',
      notes TEXT DEFAULT '[]',
      sort_order INTEGER
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      va TEXT NOT NULL,
      date TEXT NOT NULL,
      late INTEGER DEFAULT 0,
      absent INTEGER DEFAULT 0,
      ooz INTEGER DEFAULT 0,
      notes TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      due_date TEXT DEFAULT '',
      priority TEXT DEFAULT 'normal',
      ts TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      va TEXT NOT NULL,
      client_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      pm_name TEXT DEFAULT '',
      conn_req_sent INTEGER DEFAULT 0,
      inmails_sent INTEGER DEFAULT 0,
      li_event_invites INTEGER DEFAULT 0,
      ts TEXT NOT NULL,
      UNIQUE(date, va, client_id)
    );
    CREATE TABLE IF NOT EXISTS meeting_draft (
      id TEXT PRIMARY KEY,
      client_id TEXT DEFAULT '',
      client_name TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      action_items TEXT DEFAULT '[]',
      updated_at TEXT DEFAULT ''
    );
  `);
  db.prepare(
    "INSERT OR IGNORE INTO meeting_draft (id, client_id, client_name, notes, action_items, updated_at) VALUES ('current', '', '', '', '[]', '')"
  ).run();
  // Migrations
  try { db.exec("ALTER TABLE clients ADD COLUMN redzone INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE activity_log ADD COLUMN interested INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE activity_log ADD COLUMN registered_ert INTEGER DEFAULT 0"); } catch {}

  // One-time seed: May 2026 attendance (Arvi & Rob excluded — they left)
  const seeded = db.prepare("SELECT value FROM settings WHERE key = ?").get("seeded_may_2026_att");
  if (!seeded) {
    const ins = db.prepare(
      "INSERT OR IGNORE INTO attendance (id, va, date, late, absent, ooz, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const MAY: Array<{ va: string; date: string; late: number; absent: number; ooz: number; notes: string }> = [
      { va: "Mary",   date: "2026-05-07", late: 0, absent: 0, ooz: 1, notes: "Internet issue" },
      { va: "Mary",   date: "2026-05-12", late: 0, absent: 1, ooz: 1, notes: "Internet issue" },
      { va: "Mary",   date: "2026-05-13", late: 0, absent: 1, ooz: 1, notes: "Internet issue" },
      { va: "Peevee", date: "2026-05-20", late: 0, absent: 0, ooz: 1, notes: "Not on zoom" },
      { va: "Peevee", date: "2026-05-21", late: 0, absent: 1, ooz: 0, notes: "" },
    ];
    for (const e of MAY) ins.run(uid(), e.va, e.date, e.late, e.absent, e.ooz, e.notes);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("seeded_may_2026_att", "1");
  }
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

export function deleteSetting(key: string): void {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
}

function rowToClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string) || "",
    va: (row.va as string) || "",
    start: (row.start as string) || "",
    status: (row.status as string) || "New Client",
    li: (row.li as string) || "",
    ert: (row.ert as string) || "",
    ertTime: (row.ert_time as string) || "",
    attendees: (row.attendees as number) || 0,
    registered: (row.registered as number) || 0,
    message: (row.message as string) || "",
    targeting: (row.targeting as string) || "",
    flag: (row.flag as string) || "",
    redzone: !!(row.redzone as number),
    notes: JSON.parse((row.notes as string) || "[]"),
  };
}

function rowToAttendance(row: Record<string, unknown>): AttendanceEntry {
  return {
    id: row.id as string,
    va: row.va as string,
    date: row.date as string,
    late: !!(row.late as number),
    absent: !!(row.absent as number),
    ooz: !!(row.ooz as number),
    notes: (row.notes as string) || "",
  };
}

export function getAllClients(): Client[] {
  const db = getDb();
  // Auto-correct: Performing clients with < 15 attendees are Slow Generating.
  // At Risk and Stopped are intentional manual overrides — never touch them.
  db.prepare(
    "UPDATE clients SET status = 'Slow Generating' WHERE attendees < 15 AND status = 'Performing'"
  ).run();
  const rows = db.prepare("SELECT * FROM clients ORDER BY sort_order ASC, rowid ASC").all();
  return (rows as Record<string, unknown>[]).map(rowToClient);
}

export function createClient(data: Omit<Client, "id"> & { note?: string }): Client {
  const db = getDb();
  const id = uid();
  const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const initNotes: Note[] = data.note ? [{ id: uid(), type: "gen", text: data.note, ts }] : [];
  const maxOrder = (db.prepare("SELECT MAX(sort_order) as m FROM clients").get() as { m: number | null }).m;

  db.prepare(`
    INSERT INTO clients (id, name, email, va, start, status, li, ert, ert_time, attendees, registered, message, targeting, flag, notes, sort_order, redzone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.name, data.email || "", data.va || "", data.start || "",
    data.status || "New Client", data.li || "", data.ert || "", data.ertTime || "",
    data.attendees || 0, data.registered || 0, data.message || "",
    data.targeting || "", data.flag || "", JSON.stringify(initNotes),
    (maxOrder ?? -1) + 1, data.redzone ? 1 : 0
  );

  return getAllClients().find((c) => c.id === id)!;
}

export function updateClient(id: string, data: Partial<Client> & { notesToAppend?: Note[]; notesReplace?: Note[] }): Client | null {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;

  let finalNotes: Note[];
  if (data.notesReplace !== undefined) {
    finalNotes = data.notesReplace;
  } else {
    finalNotes = JSON.parse((existing.notes as string) || "[]");
    if (data.notesToAppend?.length) finalNotes.push(...data.notesToAppend);
  }

  const fields: Record<string, unknown> = { notes: JSON.stringify(finalNotes) };
  if (data.name !== undefined) fields.name = data.name;
  if (data.email !== undefined) fields.email = data.email;
  if (data.va !== undefined) fields.va = data.va;
  if (data.start !== undefined) fields.start = data.start;
  if (data.status !== undefined) fields.status = data.status;
  if (data.li !== undefined) fields.li = data.li;
  if (data.ert !== undefined) fields.ert = data.ert;
  if (data.ertTime !== undefined) fields.ert_time = data.ertTime;
  if (data.attendees !== undefined) fields.attendees = data.attendees;
  if (data.registered !== undefined) fields.registered = data.registered;
  if (data.message !== undefined) fields.message = data.message;
  if (data.targeting !== undefined) fields.targeting = data.targeting;
  if (data.flag !== undefined) fields.flag = data.flag;
  if (data.redzone !== undefined) fields.redzone = data.redzone ? 1 : 0;

  const setClauses = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE clients SET ${setClauses} WHERE id = ?`).run(...Object.values(fields), id);

  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  return row ? rowToClient(row as Record<string, unknown>) : null;
}

export function deleteClient(id: string): void {
  getDb().prepare("DELETE FROM clients WHERE id = ?").run(id);
}

export function getAllAttendance(): AttendanceEntry[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM attendance ORDER BY date ASC").all();
  return (rows as Record<string, unknown>[]).map(rowToAttendance);
}

export function createAttendance(data: Omit<AttendanceEntry, "id">): AttendanceEntry {
  const db = getDb();
  const id = uid();
  db.prepare(`
    INSERT INTO attendance (id, va, date, late, absent, ooz, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.va, data.date, data.late ? 1 : 0, data.absent ? 1 : 0, data.ooz ? 1 : 0, data.notes || "");
  return { id, ...data };
}

export function deleteAttendance(id: string): void {
  getDb().prepare("DELETE FROM attendance WHERE id = ?").run(id);
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    text: row.text as string,
    done: !!(row.done as number),
    dueDate: (row.due_date as string) || "",
    priority: ((row.priority as string) || "normal") as Task["priority"],
    ts: row.ts as string,
  };
}

export function getAllTasks(): Task[] {
  const rows = getDb().prepare("SELECT * FROM tasks ORDER BY done ASC, rowid DESC").all();
  return (rows as Record<string, unknown>[]).map(rowToTask);
}

export function createTask(data: { text: string; dueDate?: string; priority?: string }): Task {
  const db = getDb();
  const id = uid();
  const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  db.prepare("INSERT INTO tasks (id, text, done, due_date, priority, ts) VALUES (?, ?, 0, ?, ?, ?)").run(
    id, data.text, data.dueDate || "", data.priority || "normal", ts
  );
  return rowToTask(db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateTask(id: string, data: { done?: boolean; text?: string; dueDate?: string; priority?: string }): Task | null {
  const db = getDb();
  const fields: Record<string, unknown> = {};
  if (data.done !== undefined) fields.done = data.done ? 1 : 0;
  if (data.text !== undefined) fields.text = data.text;
  if (data.dueDate !== undefined) fields.due_date = data.dueDate;
  if (data.priority !== undefined) fields.priority = data.priority;
  if (!Object.keys(fields).length) return null;
  const setClauses = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ?`).run(...Object.values(fields), id);
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return row ? rowToTask(row as Record<string, unknown>) : null;
}

export function deleteTask(id: string): void {
  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

export function getMeetingDraft(): MeetingDraft {
  const row = getDb().prepare("SELECT * FROM meeting_draft WHERE id = 'current'").get() as Record<string, unknown> | undefined;
  if (!row) return { clientId: "", clientName: "", notes: "", actionItems: [], updatedAt: "" };
  return {
    clientId: (row.client_id as string) || "",
    clientName: (row.client_name as string) || "",
    notes: (row.notes as string) || "",
    actionItems: JSON.parse((row.action_items as string) || "[]"),
    updatedAt: (row.updated_at as string) || "",
  };
}

function rowToActivityLog(row: Record<string, unknown>): ActivityLog {
  return {
    id: row.id as string,
    date: row.date as string,
    va: row.va as string,
    clientId: row.client_id as string,
    clientName: row.client_name as string,
    pmName: (row.pm_name as string) || "",
    connReqSent: (row.conn_req_sent as number) || 0,
    inmailsSent: (row.inmails_sent as number) || 0,
    liEventInvites: (row.li_event_invites as number) || 0,
    interested: (row.interested as number) || 0,
    registeredErt: (row.registered_ert as number) || 0,
    ts: row.ts as string,
  };
}

export function getAllActivityLogs(): ActivityLog[] {
  const rows = getDb().prepare("SELECT * FROM activity_log ORDER BY date DESC, ts DESC").all();
  return (rows as Record<string, unknown>[]).map(rowToActivityLog);
}

export function createActivityLog(data: Omit<ActivityLog, "id" | "ts">): ActivityLog | { duplicate: true } {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM activity_log WHERE date = ? AND va = ? AND client_id = ?")
    .get(data.date, data.va, data.clientId);
  if (existing) return { duplicate: true };
  const id = uid();
  const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  db.prepare(`
    INSERT INTO activity_log (id, date, va, client_id, client_name, pm_name, conn_req_sent, inmails_sent, li_event_invites, interested, registered_ert, ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.date, data.va, data.clientId, data.clientName, data.pmName || "", data.connReqSent, data.inmailsSent, data.liEventInvites, data.interested, data.registeredErt, ts);
  return rowToActivityLog(db.prepare("SELECT * FROM activity_log WHERE id = ?").get(id) as Record<string, unknown>);
}

export function saveMeetingDraft(data: Partial<MeetingDraft>): void {
  const db = getDb();
  const now = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const fields: Record<string, unknown> = { updated_at: now };
  if (data.clientId !== undefined) fields.client_id = data.clientId;
  if (data.clientName !== undefined) fields.client_name = data.clientName;
  if (data.notes !== undefined) fields.notes = data.notes;
  if (data.actionItems !== undefined) fields.action_items = JSON.stringify(data.actionItems);
  const setClauses = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE meeting_draft SET ${setClauses} WHERE id = 'current'`).run(...Object.values(fields));
}
