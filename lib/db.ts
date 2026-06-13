import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Client, AttendanceEntry, Note, Task, MeetingDraft, ActivityLog } from "@/types";
import { uid } from "./utils";

export type UserRole = "owner" | "member" | "admin";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  mondayApiToken: string;
  googleAccessToken: string;
  googleRefreshToken: string;
  googleTokenExpiry: string;
}

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
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      email        TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name         TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'member',
      created_at   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id              TEXT PRIMARY KEY,
      monday_api_token     TEXT DEFAULT '',
      google_access_token  TEXT DEFAULT '',
      google_refresh_token TEXT DEFAULT '',
      google_token_expiry  TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS meeting_draft_v2 (
      user_id      TEXT PRIMARY KEY,
      client_id    TEXT DEFAULT '',
      client_name  TEXT DEFAULT '',
      notes        TEXT DEFAULT '',
      action_items TEXT DEFAULT '[]',
      updated_at   TEXT DEFAULT ''
    );
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
    CREATE TABLE IF NOT EXISTS monday_seen (
      notification_id TEXT PRIMARY KEY
    );
  `);
  db.prepare(
    "INSERT OR IGNORE INTO meeting_draft (id, client_id, client_name, notes, action_items, updated_at) VALUES ('current', '', '', '', '[]', '')"
  ).run();
  // Migrations
  try { db.exec("ALTER TABLE clients ADD COLUMN redzone INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE activity_log ADD COLUMN interested INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE activity_log ADD COLUMN registered_ert INTEGER DEFAULT 0"); } catch {}
  // Multi-user migration: add user_id to all data tables
  try { db.exec("ALTER TABLE clients ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE attendance ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE activity_log ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE monday_seen ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"); } catch {}

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

// ─── Settings ────────────────────────────────────────────────────────────────

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

// ─── Users ────────────────────────────────────────────────────────────────────

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    name: row.name as string,
    role: row.role as UserRole,
    createdAt: row.created_at as string,
  };
}

export function countUsers(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number };
  return row.n;
}

export function createUser(email: string, passwordHash: string, name: string, role: UserRole): User {
  const db = getDb();
  const id = uid();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, email.toLowerCase(), passwordHash, name, role, createdAt);
  return rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown>);
}

export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function getAllUsers(): User[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at ASC").all();
  return (rows as Record<string, unknown>[]).map(rowToUser);
}

export function deleteUser(id: string): void {
  getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function updateUserPassword(id: string, passwordHash: string): void {
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

// ─── User Settings ────────────────────────────────────────────────────────────

function rowToUserSettings(row: Record<string, unknown>): UserSettings {
  return {
    userId: row.user_id as string,
    mondayApiToken: (row.monday_api_token as string) || "",
    googleAccessToken: (row.google_access_token as string) || "",
    googleRefreshToken: (row.google_refresh_token as string) || "",
    googleTokenExpiry: (row.google_token_expiry as string) || "",
  };
}

export function getUserSettings(userId: string): UserSettings {
  const db = getDb();
  const row = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(userId) as Record<string, unknown> | undefined;
  if (!row) return { userId, mondayApiToken: "", googleAccessToken: "", googleRefreshToken: "", googleTokenExpiry: "" };
  return rowToUserSettings(row);
}

export function saveUserSettings(userId: string, settings: Partial<Omit<UserSettings, "userId">>): void {
  const db = getDb();
  const fields: Record<string, unknown> = {};
  if (settings.mondayApiToken !== undefined) fields.monday_api_token = settings.mondayApiToken;
  if (settings.googleAccessToken !== undefined) fields.google_access_token = settings.googleAccessToken;
  if (settings.googleRefreshToken !== undefined) fields.google_refresh_token = settings.googleRefreshToken;
  if (settings.googleTokenExpiry !== undefined) fields.google_token_expiry = settings.googleTokenExpiry;

  const existing = db.prepare("SELECT user_id FROM user_settings WHERE user_id = ?").get(userId);
  if (existing) {
    if (!Object.keys(fields).length) return;
    const setClauses = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE user_settings SET ${setClauses} WHERE user_id = ?`).run(...Object.values(fields), userId);
  } else {
    db.prepare(
      "INSERT INTO user_settings (user_id, monday_api_token, google_access_token, google_refresh_token, google_token_expiry) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, fields.monday_api_token ?? "", fields.google_access_token ?? "", fields.google_refresh_token ?? "", fields.google_token_expiry ?? "");
  }
}

// ─── Data migration (run once when first user/owner registers) ────────────────

export function migrateDataToOwner(userId: string): void {
  const db = getDb();
  const migrate = db.transaction(() => {
    db.prepare("UPDATE clients SET user_id = ? WHERE user_id = ''").run(userId);
    db.prepare("UPDATE tasks SET user_id = ? WHERE user_id = ''").run(userId);
    db.prepare("UPDATE attendance SET user_id = ? WHERE user_id = ''").run(userId);
    db.prepare("UPDATE activity_log SET user_id = ? WHERE user_id = ''").run(userId);
    db.prepare("UPDATE monday_seen SET user_id = ? WHERE user_id = ''").run(userId);
    // Migrate legacy meeting_draft row to new per-user table
    const legacy = db.prepare("SELECT * FROM meeting_draft WHERE id = 'current'").get() as Record<string, unknown> | undefined;
    if (legacy) {
      db.prepare(
        "INSERT OR IGNORE INTO meeting_draft_v2 (user_id, client_id, client_name, notes, action_items, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(userId, legacy.client_id, legacy.client_name, legacy.notes, legacy.action_items, legacy.updated_at);
    }
  });
  migrate();
}

// ─── Clients ──────────────────────────────────────────────────────────────────

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

export function getClients(userId: string): Client[] {
  const db = getDb();
  // Auto-correct: Performing clients with < 15 attendees are Slow Generating.
  // At Risk and Stopped are intentional manual overrides — never touch them.
  db.prepare(
    "UPDATE clients SET status = 'Slow Generating' WHERE attendees < 15 AND status = 'Performing' AND user_id = ?"
  ).run(userId);
  const rows = db.prepare("SELECT * FROM clients WHERE user_id = ? ORDER BY sort_order ASC, rowid ASC").all(userId);
  return (rows as Record<string, unknown>[]).map(rowToClient);
}

export function createClient(data: Omit<Client, "id"> & { note?: string }, userId: string): Client {
  const db = getDb();
  const id = uid();
  const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const initNotes: Note[] = data.note ? [{ id: uid(), type: "gen", text: data.note, ts }] : [];
  const maxOrder = (db.prepare("SELECT MAX(sort_order) as m FROM clients WHERE user_id = ?").get(userId) as { m: number | null }).m;

  db.prepare(`
    INSERT INTO clients (id, name, email, va, start, status, li, ert, ert_time, attendees, registered, message, targeting, flag, notes, sort_order, redzone, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.name, data.email || "", data.va || "", data.start || "",
    data.status || "New Client", data.li || "", data.ert || "", data.ertTime || "",
    data.attendees || 0, data.registered || 0, data.message || "",
    data.targeting || "", data.flag || "", JSON.stringify(initNotes),
    (maxOrder ?? -1) + 1, data.redzone ? 1 : 0, userId
  );

  return getClients(userId).find((c) => c.id === id)!;
}

export function updateClient(id: string, data: Partial<Client> & { notesToAppend?: Note[]; notesReplace?: Note[] }, userId: string): Client | null {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM clients WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | undefined;
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
  db.prepare(`UPDATE clients SET ${setClauses} WHERE id = ? AND user_id = ?`).run(...Object.values(fields), id, userId);

  const row = db.prepare("SELECT * FROM clients WHERE id = ? AND user_id = ?").get(id, userId);
  return row ? rowToClient(row as Record<string, unknown>) : null;
}

export function deleteClient(id: string, userId: string): void {
  getDb().prepare("DELETE FROM clients WHERE id = ? AND user_id = ?").run(id, userId);
}

// ─── Attendance ───────────────────────────────────────────────────────────────

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

export function getAttendance(userId: string): AttendanceEntry[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM attendance WHERE user_id = ? ORDER BY date ASC").all(userId);
  return (rows as Record<string, unknown>[]).map(rowToAttendance);
}

export function createAttendance(data: Omit<AttendanceEntry, "id">, userId: string): AttendanceEntry {
  const db = getDb();
  const id = uid();
  db.prepare(`
    INSERT INTO attendance (id, va, date, late, absent, ooz, notes, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.va, data.date, data.late ? 1 : 0, data.absent ? 1 : 0, data.ooz ? 1 : 0, data.notes || "", userId);
  return { id, ...data };
}

export function deleteAttendance(id: string, userId: string): void {
  getDb().prepare("DELETE FROM attendance WHERE id = ? AND user_id = ?").run(id, userId);
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

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

export function getTasks(userId: string): Task[] {
  const rows = getDb().prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY done ASC, rowid DESC").all(userId);
  return (rows as Record<string, unknown>[]).map(rowToTask);
}

export function createTask(data: { text: string; dueDate?: string; priority?: string }, userId: string): Task {
  const db = getDb();
  const id = uid();
  const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  db.prepare("INSERT INTO tasks (id, text, done, due_date, priority, ts, user_id) VALUES (?, ?, 0, ?, ?, ?, ?)").run(
    id, data.text, data.dueDate || "", data.priority || "normal", ts, userId
  );
  return rowToTask(db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown>);
}

export function updateTask(id: string, data: { done?: boolean; text?: string; dueDate?: string; priority?: string }, userId: string): Task | null {
  const db = getDb();
  const fields: Record<string, unknown> = {};
  if (data.done !== undefined) fields.done = data.done ? 1 : 0;
  if (data.text !== undefined) fields.text = data.text;
  if (data.dueDate !== undefined) fields.due_date = data.dueDate;
  if (data.priority !== undefined) fields.priority = data.priority;
  if (!Object.keys(fields).length) return null;
  const setClauses = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ? AND user_id = ?`).run(...Object.values(fields), id, userId);
  const row = db.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?").get(id, userId);
  return row ? rowToTask(row as Record<string, unknown>) : null;
}

export function deleteTask(id: string, userId: string): void {
  getDb().prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(id, userId);
}

// ─── Meeting Draft ────────────────────────────────────────────────────────────

export function getMeetingDraft(userId: string): MeetingDraft {
  const row = getDb().prepare("SELECT * FROM meeting_draft_v2 WHERE user_id = ?").get(userId) as Record<string, unknown> | undefined;
  if (!row) return { clientId: "", clientName: "", notes: "", actionItems: [], updatedAt: "" };
  return {
    clientId: (row.client_id as string) || "",
    clientName: (row.client_name as string) || "",
    notes: (row.notes as string) || "",
    actionItems: JSON.parse((row.action_items as string) || "[]"),
    updatedAt: (row.updated_at as string) || "",
  };
}

export function saveMeetingDraft(data: Partial<MeetingDraft>, userId: string): void {
  const db = getDb();
  const now = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const existing = db.prepare("SELECT user_id FROM meeting_draft_v2 WHERE user_id = ?").get(userId);
  if (existing) {
    const fields: Record<string, unknown> = { updated_at: now };
    if (data.clientId !== undefined) fields.client_id = data.clientId;
    if (data.clientName !== undefined) fields.client_name = data.clientName;
    if (data.notes !== undefined) fields.notes = data.notes;
    if (data.actionItems !== undefined) fields.action_items = JSON.stringify(data.actionItems);
    const setClauses = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE meeting_draft_v2 SET ${setClauses} WHERE user_id = ?`).run(...Object.values(fields), userId);
  } else {
    db.prepare(
      "INSERT INTO meeting_draft_v2 (user_id, client_id, client_name, notes, action_items, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      userId,
      data.clientId ?? "",
      data.clientName ?? "",
      data.notes ?? "",
      data.actionItems !== undefined ? JSON.stringify(data.actionItems) : "[]",
      now
    );
  }
}

// ─── Activity Logs ────────────────────────────────────────────────────────────

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

export function getActivityLogs(userId: string): ActivityLog[] {
  const rows = getDb().prepare("SELECT * FROM activity_log WHERE user_id = ? ORDER BY date DESC, ts DESC").all(userId);
  return (rows as Record<string, unknown>[]).map(rowToActivityLog);
}

export function createActivityLog(data: Omit<ActivityLog, "id" | "ts">, userId: string): ActivityLog | { duplicate: true } {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM activity_log WHERE date = ? AND va = ? AND client_id = ? AND user_id = ?")
    .get(data.date, data.va, data.clientId, userId);
  if (existing) return { duplicate: true };
  const id = uid();
  const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  db.prepare(`
    INSERT INTO activity_log (id, date, va, client_id, client_name, pm_name, conn_req_sent, inmails_sent, li_event_invites, interested, registered_ert, ts, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.date, data.va, data.clientId, data.clientName, data.pmName || "", data.connReqSent, data.inmailsSent, data.liEventInvites, data.interested, data.registeredErt, ts, userId);
  return rowToActivityLog(db.prepare("SELECT * FROM activity_log WHERE id = ?").get(id) as Record<string, unknown>);
}

// ─── Monday Seen Notifications ────────────────────────────────────────────────

export function getSeenNotifications(userId: string): string[] {
  const db = getDb();
  return (db.prepare("SELECT notification_id FROM monday_seen WHERE user_id = ?").all(userId) as { notification_id: string }[])
    .map((r) => r.notification_id);
}

export function markNotificationSeen(notificationId: string, userId: string): void {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO monday_seen (notification_id, user_id) VALUES (?, ?)").run(notificationId, userId);
}
