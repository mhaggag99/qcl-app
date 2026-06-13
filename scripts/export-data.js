// Run with: node scripts/export-data.js
// Exports all owner data from the local database to data-export.json

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../data/qcl.db");
if (!fs.existsSync(dbPath)) {
  console.error("Database not found at", dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

const owner = db.prepare("SELECT * FROM users WHERE role = 'owner'").get();
if (!owner) {
  console.error("No owner account found in local database.");
  process.exit(1);
}

console.log(`Exporting data for owner: ${owner.email} (${owner.id})`);

const data = {
  clients:      db.prepare("SELECT * FROM clients      WHERE user_id = ?").all(owner.id),
  tasks:        db.prepare("SELECT * FROM tasks        WHERE user_id = ?").all(owner.id),
  attendance:   db.prepare("SELECT * FROM attendance   WHERE user_id = ?").all(owner.id),
  activityLog:  db.prepare("SELECT * FROM activity_log WHERE user_id = ?").all(owner.id),
  mondaySeen:   db.prepare("SELECT * FROM monday_seen  WHERE user_id = ?").all(owner.id),
  meetingDraft: db.prepare("SELECT * FROM meeting_draft_v2 WHERE user_id = ?").get(owner.id) ?? null,
  userSettings: db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(owner.id) ?? null,
};

const outPath = path.join(__dirname, "../data-export.json");
fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

console.log("");
console.log("✓ Export complete → data-export.json");
console.log(`  Clients:      ${data.clients.length}`);
console.log(`  Tasks:        ${data.tasks.length}`);
console.log(`  Attendance:   ${data.attendance.length}`);
console.log(`  Activity log: ${data.activityLog.length}`);
console.log(`  Monday seen:  ${data.mondaySeen.length}`);
console.log(`  Meeting draft: ${data.meetingDraft ? "yes" : "none"}`);
console.log(`  Settings:     ${data.userSettings ? "yes" : "none"}`);
console.log("");
console.log("Next: go to the admin panel on Railway → Import Data → upload data-export.json");
