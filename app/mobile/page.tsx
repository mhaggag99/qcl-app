"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Client, Task, AttendanceEntry, MeetingDraft, MeetingActionItem, Note, RoundtableEvent, ActivityLog } from "@/types";
import { QCLCompact, QCLLoadingScreen } from "@/components/QCLLogo";

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:      "#060810",
  bg2:     "#090d1c",
  bg3:     "#0f1628",
  border:  "#111d36",
  border2: "#1c2f50",
  text:    "#e2eaf8",
  muted:   "#4a6080",
  green:   "#0fcf8a",
  amber:   "#ffab1a",
  red:     "#ff4d6a",
  blue:    "#4ba3ff",
  purple:  "#9b7ff5",
};

const STATUS_COLOR: Record<string, string> = {
  "New Client": C.blue, "Performing": C.green,
  "Slow Generating": C.amber, "At Risk": C.red, "Stopped": C.muted,
};

const VA_COLOR: Record<string, string> = {
  Rosalie: C.purple, Aliah: C.amber, Arvi: C.blue, Peevee: C.green,
};

const VAS = ["Rosalie", "Aliah", "Arvi", "Peevee"];
const PRIORITY_COLOR: Record<string, string> = { normal: C.muted, important: C.amber, urgent: C.red };

function uid() { return Math.random().toString(36).slice(2, 11); }
function tsNow() { return new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function fmtDate(d: string) { if (!d) return ""; try { return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); } catch { return d; } }
function daysUntil(d: string) { if (!d) return null; const diff = Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000); return diff; }

// ─── Shared primitives ────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", padding: "12px 14px", background: C.bg3,
  border: `1px solid ${C.border2}`, borderRadius: 10,
  color: C.text, fontSize: 15, outline: "none", boxSizing: "border-box",
};

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: `${color}18`, border: `1px solid ${color}30`, color, flexShrink: 0 }}>
      {text}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase",
        color: C.muted, marginBottom: 10, paddingLeft: 2 }}>{title}</div>
      {children}
    </div>
  );
}

function Card({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "13px 15px", marginBottom: 8, ...style }}>
      {children}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div style={{ textAlign: "center", color: C.muted, fontSize: 14, padding: "40px 0" }}>{msg}</div>;
}

function Spinner() {
  return <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "32px 0" }}>Loading…</div>;
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────

function OverviewTab({ clients, tasks, setTasks, onSwitchTab }: {
  clients: Client[];
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onSwitchTab: (t: string) => void;
}) {
  const [newTask, setNewTask] = useState("");
  const [draft, setDraft] = useState<MeetingDraft | null>(null);

  useEffect(() => {
    fetch("/api/meeting-draft").then(r => r.json()).then(d => { if (d.draft) setDraft(d.draft); });
  }, []);

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const upcoming = clients
    .filter(c => { if (!c.ert) return false; const d = daysUntil(c.ert); return d !== null && d >= 0 && d <= 30; })
    .sort((a, b) => (a.ert < b.ert ? -1 : 1))
    .slice(0, 8);

  const atRisk = clients.filter(c => c.status === "At Risk" || c.redzone).length;
  const activeTasks = tasks.filter(t => !t.done);

  async function addTask() {
    if (!newTask.trim()) return;
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: newTask.trim() }) });
    if (res.ok) { const d = await res.json(); setTasks(ts => [d.task, ...ts]); setNewTask(""); }
  }

  async function completeTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) });
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: true } : t));
  }

  return (
    <div style={{ padding: "4px 16px 24px", overflowY: "auto", flex: 1 }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
        {[
          { label: "Clients", value: clients.filter(c => c.status !== "Stopped").length, color: C.blue },
          { label: "At Risk", value: atRisk, color: atRisk > 0 ? C.red : C.muted },
          { label: "Tasks", value: activeTasks.length, color: activeTasks.length > 0 ? C.amber : C.muted },
        ].map(s => (
          <div key={s.label} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Upcoming ERTs */}
      <Section title={`Upcoming ERTs (${upcoming.length})`}>
        {upcoming.length === 0
          ? <EmptyState msg="No ERTs in the next 30 days" />
          : upcoming.map(c => {
            const days = daysUntil(c.ert)!;
            return (
              <Card key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => onSwitchTab("clients")}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                    {fmtDate(c.ert)}{c.va ? ` · ${c.va}` : ""}
                    {c.attendees > 0 ? ` · ✓ ${c.attendees}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: days <= 3 ? C.red : days <= 7 ? C.amber : C.blue }}>{days}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{days === 1 ? "day" : "days"}</div>
                </div>
              </Card>
            );
          })
        }
      </Section>

      {/* Quick tasks */}
      <Section title="Tasks">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input style={{ ...inp, flex: 1, padding: "10px 12px" }} placeholder="Add a task…" value={newTask}
            onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} />
          <button onClick={addTask} style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(75,163,255,0.15)", border: "1px solid rgba(75,163,255,0.3)", color: C.blue, fontSize: 15, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>+</button>
        </div>
        {activeTasks.length === 0 && <EmptyState msg="No active tasks" />}
        {activeTasks.slice(0, 5).map(t => (
          <Card key={t.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div onClick={() => completeTask(t.id)} style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${PRIORITY_COLOR[t.priority]}`, flexShrink: 0, cursor: "pointer" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: C.text }}>{t.text}</div>
              {t.dueDate && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Due {fmtDate(t.dueDate)}</div>}
            </div>
            {t.priority !== "normal" && <span style={{ color: PRIORITY_COLOR[t.priority], fontSize: 13, fontWeight: 700 }}>{t.priority === "urgent" ? "!!" : "★"}</span>}
          </Card>
        ))}
        {activeTasks.length > 5 && (
          <button onClick={() => onSwitchTab("tasks")} style={{ width: "100%", padding: "10px", background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 10, color: C.muted, fontSize: 13, cursor: "pointer" }}>
            View all {activeTasks.length} tasks →
          </button>
        )}
      </Section>

      {/* Meeting draft shortcut */}
      {draft && (draft.clientName || draft.notes) && (
        <Section title="Meeting Draft">
          <Card style={{ cursor: "pointer" }} onClick={() => onSwitchTab("meeting")}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{draft.clientName || "No client selected"}</div>
            {draft.notes && <div style={{ fontSize: 13, color: C.muted, marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{draft.notes}</div>}
            {draft.actionItems?.length > 0 && <div style={{ fontSize: 12, color: C.blue, marginTop: 6 }}>{draft.actionItems.filter(i => !i.done).length} open action items</div>}
          </Card>
        </Section>
      )}
    </div>
  );
}

// ─── CLIENTS TAB ──────────────────────────────────────────────────────────────

function ClientsTab({ clients, setClients }: { clients: Client[]; setClients: React.Dispatch<React.SetStateAction<Client[]>> }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [filter, setFilter] = useState<"All" | "At Risk" | "Performing" | "New Client">("All");

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || (c.va || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "All" || c.status === filter;
    return matchSearch && matchFilter;
  });

  async function addNote() {
    if (!selected || !noteText.trim()) return;
    setAddingNote(true);
    const note: Note = { id: uid(), type: "gen", text: noteText.trim(), ts: tsNow() };
    const res = await fetch(`/api/clients/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notesToAppend: [note] }) });
    if (res.ok) {
      const d = await res.json();
      const updated = d.client ?? d;
      setSelected(updated);
      setClients(cs => cs.map(c => c.id === updated.id ? updated : c));
      setNoteText("");
    }
    setAddingNote(false);
  }

  if (selected) {
    const notes = [...(selected.notes ?? [])].reverse().slice(0, 10);
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Detail header */}
        <div style={{ padding: "0 16px 12px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.blue, fontSize: 15, padding: "6px 0 10px", cursor: "pointer" }}>← All Clients</button>
          <div style={{ fontSize: 19, fontWeight: 700, color: C.text }}>{selected.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <Pill text={selected.status} color={STATUS_COLOR[selected.status] ?? C.muted} />
            {selected.va && <Pill text={selected.va} color={VA_COLOR[selected.va] ?? C.muted} />}
            {selected.ert && <Pill text={`ERT ${fmtDate(selected.ert)}`} color={C.purple} />}
            {selected.attendees > 0 && <Pill text={`✓ ${selected.attendees} attending`} color={C.green} />}
          </div>
          {selected.flag && <div style={{ marginTop: 8, fontSize: 13, color: C.amber }}>⚑ {selected.flag}</div>}
        </div>
        {/* Detail content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          {/* Add note */}
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note…" rows={3}
            style={{ ...inp, resize: "none", marginBottom: 8 }} />
          <button onClick={addNote} disabled={addingNote || !noteText.trim()}
            style={{ width: "100%", padding: "12px", borderRadius: 10, marginBottom: 20,
              background: noteText.trim() ? "rgba(75,163,255,0.15)" : C.bg3,
              border: `1px solid ${noteText.trim() ? "rgba(75,163,255,0.3)" : C.border}`,
              color: noteText.trim() ? C.blue : C.muted, fontSize: 15, fontWeight: 600, cursor: noteText.trim() ? "pointer" : "default" }}>
            {addingNote ? "Saving…" : "Add Note"}
          </button>
          {notes.length > 0 && (
            <Section title="Notes">
              {notes.map(n => (
                <Card key={n.id}>
                  <div style={{ fontSize: 14, color: C.text, lineHeight: 1.55 }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{n.ts}</div>
                </Card>
              ))}
            </Section>
          )}
          {notes.length === 0 && <EmptyState msg="No notes yet" />}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Search + filter */}
      <div style={{ padding: "0 16px 10px", flexShrink: 0 }}>
        <input style={{ ...inp, marginBottom: 8 }} placeholder="Search by name or VA…" value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {(["All", "At Risk", "Performing", "New Client"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, flexShrink: 0, cursor: "pointer",
              background: filter === f ? "rgba(75,163,255,0.18)" : "transparent",
              border: `1px solid ${filter === f ? "rgba(75,163,255,0.4)" : C.border2}`,
              color: filter === f ? C.blue : C.muted }}>
              {f}
            </button>
          ))}
        </div>
      </div>
      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
        {filtered.length === 0 && <EmptyState msg="No clients found" />}
        {filtered.map(c => (
          <Card key={c.id} style={{ cursor: "pointer", borderLeft: c.redzone ? `3px solid ${C.red}` : `3px solid transparent` }} onClick={() => setSelected(c)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: C.text, flex: 1 }}>{c.name}</div>
              <Pill text={c.status} color={STATUS_COLOR[c.status] ?? C.muted} />
            </div>
            <div style={{ marginTop: 5, display: "flex", gap: 10, fontSize: 12, color: C.muted, flexWrap: "wrap" }}>
              {c.va && <span style={{ color: VA_COLOR[c.va] ?? C.muted }}>● {c.va}</span>}
              {c.ert && <span>📅 {fmtDate(c.ert)} {daysUntil(c.ert) !== null ? `(${daysUntil(c.ert)}d)` : ""}</span>}
              {c.attendees > 0 && <span style={{ color: C.green }}>✓ {c.attendees}</span>}
            </div>
            {c.flag && <div style={{ marginTop: 5, fontSize: 12, color: C.amber }}>⚑ {c.flag}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── TASKS TAB ────────────────────────────────────────────────────────────────

function TasksTab({ tasks, setTasks }: { tasks: Task[]; setTasks: React.Dispatch<React.SetStateAction<Task[]>> }) {
  const [newTask, setNewTask] = useState("");
  const [showDone, setShowDone] = useState(false);

  async function addTask() {
    if (!newTask.trim()) return;
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: newTask.trim() }) });
    if (res.ok) { const d = await res.json(); setTasks(ts => [d.task, ...ts]); setNewTask(""); }
  }

  async function toggle(task: Task) {
    await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !task.done }) });
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
  }

  const active = tasks.filter(t => !t.done).sort((a, b) => (b.priority === "urgent" ? 1 : b.priority === "important" ? 0.5 : 0) - (a.priority === "urgent" ? 1 : a.priority === "important" ? 0.5 : 0));
  const done = tasks.filter(t => t.done);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "0 16px 10px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inp, flex: 1 }} placeholder="Add a task…" value={newTask}
            onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} />
          <button onClick={addTask} style={{ padding: "12px 18px", borderRadius: 10, background: "rgba(75,163,255,0.15)", border: "1px solid rgba(75,163,255,0.3)", color: C.blue, fontSize: 16, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>+</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
        {active.length === 0 && done.length === 0 && <EmptyState msg="No tasks yet" />}
        {active.map(t => (
          <Card key={t.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div onClick={() => toggle(t)} style={{ width: 26, height: 26, borderRadius: 8, border: `2px solid ${PRIORITY_COLOR[t.priority]}`, flexShrink: 0, cursor: "pointer" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, color: C.text }}>{t.text}</div>
              {t.dueDate && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Due {fmtDate(t.dueDate)}</div>}
            </div>
            {t.priority !== "normal" && <span style={{ fontSize: 14, fontWeight: 700, color: PRIORITY_COLOR[t.priority] }}>{t.priority === "urgent" ? "!!" : "★"}</span>}
          </Card>
        ))}
        {done.length > 0 && (
          <>
            <button onClick={() => setShowDone(s => !s)} style={{ width: "100%", padding: "10px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
              {showDone ? "Hide" : "Show"} done ({done.length})
            </button>
            {showDone && done.map(t => (
              <Card key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, opacity: 0.5 }}>
                <div onClick={() => toggle(t)} style={{ width: 26, height: 26, borderRadius: 8, border: `2px solid ${C.green}`, flexShrink: 0, cursor: "pointer", background: "rgba(15,207,138,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: C.green, fontSize: 13 }}>✓</span>
                </div>
                <div style={{ fontSize: 14, color: C.muted, textDecoration: "line-through" }}>{t.text}</div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MEETING TAB ──────────────────────────────────────────────────────────────

function MeetingTab({ clients, setTasks }: { clients: Client[]; setTasks: React.Dispatch<React.SetStateAction<Task[]>> }) {
  const [draft, setDraft] = useState<MeetingDraft>({ clientId: "", clientName: "", notes: "", actionItems: [], updatedAt: "" });
  const [newItem, setNewItem] = useState("");
  const [status, setStatus] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/meeting-draft").then(r => r.json()).then(d => { if (d.draft) setDraft(d.draft); });
  }, []);

  function scheduleSave(updated: MeetingDraft) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch("/api/meeting-draft", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      setStatus("Saved");
      setTimeout(() => setStatus(""), 1500);
    }, 800);
    setStatus("Saving…");
  }

  function update(patch: Partial<MeetingDraft>) {
    const updated = { ...draft, ...patch };
    setDraft(updated);
    scheduleSave(updated);
  }

  function selectClient(clientId: string) {
    const c = clients.find(c => c.id === clientId);
    update({ clientId, clientName: c?.name ?? "" });
  }

  function addItem() {
    if (!newItem.trim()) return;
    update({ actionItems: [...draft.actionItems, { id: uid(), text: newItem.trim(), done: false }] });
    setNewItem("");
  }

  function toggleItem(id: string) {
    update({ actionItems: draft.actionItems.map(i => i.id === id ? { ...i, done: !i.done } : i) });
  }

  function removeItem(id: string) {
    update({ actionItems: draft.actionItems.filter(i => i.id !== id) });
  }

  async function pushToTasks() {
    const undone = draft.actionItems.filter(i => !i.done);
    for (const item of undone) {
      const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: draft.clientName ? `${draft.clientName} — ${item.text}` : item.text }) });
      if (res.ok) { const d = await res.json(); setTasks(ts => [...ts, d.task]); }
    }
    setStatus(`✓ ${undone.length} pushed to tasks`);
    setTimeout(() => setStatus(""), 2500);
  }

  async function clear() {
    if (!confirm("Clear the meeting draft?")) return;
    const cleared: MeetingDraft = { clientId: "", clientName: "", notes: "", actionItems: [], updatedAt: "" };
    setDraft(cleared);
    await fetch("/api/meeting-draft", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cleared) });
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
      {/* Client selector */}
      <div style={{ marginBottom: 14 }}>
        <select value={draft.clientId} onChange={e => selectClient(e.target.value)}
          style={{ ...inp, color: draft.clientId ? C.text : C.muted }}>
          <option value="">Select client…</option>
          {clients.filter(c => c.status !== "Stopped").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Notes */}
      <Section title="Meeting Notes">
        <textarea value={draft.notes} onChange={e => update({ notes: e.target.value })}
          placeholder="Notes from the call…" rows={6}
          style={{ ...inp, resize: "none", lineHeight: 1.6 }} />
        {status && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{status}</div>}
      </Section>

      {/* Action items */}
      <Section title={`Action Items (${draft.actionItems.length})`}>
        {draft.actionItems.map(item => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div onClick={() => toggleItem(item.id)} style={{ width: 26, height: 26, borderRadius: 8, border: `2px solid ${item.done ? C.green : C.border2}`, flexShrink: 0, cursor: "pointer", background: item.done ? "rgba(15,207,138,0.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {item.done && <span style={{ color: C.green, fontSize: 13 }}>✓</span>}
            </div>
            <span style={{ flex: 1, fontSize: 14, color: item.done ? C.muted : C.text, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
            <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: C.muted, fontSize: 16, cursor: "pointer", padding: "0 4px" }}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inp, flex: 1 }} placeholder="Add action item…" value={newItem}
            onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} />
          <button onClick={addItem} style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(75,163,255,0.12)", border: "1px solid rgba(75,163,255,0.25)", color: C.blue, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>+</button>
        </div>
      </Section>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        {draft.actionItems.some(i => !i.done) && (
          <button onClick={pushToTasks} style={{ flex: 1, padding: "13px", borderRadius: 10, background: "rgba(155,127,245,0.12)", border: "1px solid rgba(155,127,245,0.3)", color: C.purple, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Push to Tasks
          </button>
        )}
        {(draft.notes || draft.actionItems.length > 0) && (
          <button onClick={clear} style={{ flex: 1, padding: "13px", borderRadius: 10, background: "transparent", border: `1px solid ${C.border2}`, color: C.muted, fontSize: 14, cursor: "pointer" }}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ROUNDTABLE TAB ───────────────────────────────────────────────────────────

function RoundtableTab() {
  const [data, setData] = useState<{ events: RoundtableEvent[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/monday/roundtable");
      const d = await res.json();
      if (!res.ok) setError(d.error === "monday_not_configured" ? "Add your Monday API token in Settings to see roundtable data." : "Could not load roundtable.");
      else setData(d);
    } catch { setError("Failed to connect to Monday."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error) return (
    <div style={{ padding: "32px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{error}</div>
      <button onClick={load} style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(75,163,255,0.12)", border: "1px solid rgba(75,163,255,0.25)", color: C.blue, fontSize: 13, cursor: "pointer" }}>Retry</button>
    </div>
  );

  const now = new Date().toISOString().slice(0, 10);
  const upcoming = (data?.events ?? []).filter(e => e.date >= now).sort((a, b) => a.date < b.date ? -1 : 1);
  const past = (data?.events ?? []).filter(e => e.date < now).sort((a, b) => a.date > b.date ? -1 : 1).slice(0, 10);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={load} style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border2}`, color: C.muted, fontSize: 12, cursor: "pointer" }}>⟳ Refresh</button>
      </div>
      <Section title={`Upcoming (${upcoming.length})`}>
        {upcoming.length === 0 && <EmptyState msg="No upcoming ERTs" />}
        {upcoming.map((ev, i) => {
          const days = daysUntil(ev.date);
          return (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{ev.clientName}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{fmtDate(ev.date)}{ev.rtTime ? ` · ${ev.rtTime}` : ""}</div>
                </div>
                {days !== null && (
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: days <= 3 ? C.red : days <= 7 ? C.amber : C.blue }}>{days}d</div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 10, fontSize: 12 }}>
                {ev.attendees !== null && <span style={{ color: C.green }}>✓ {ev.attendees} attending</span>}
                {ev.registered !== null && <span style={{ color: C.muted }}>Reg: {ev.registered}</span>}
                {ev.calendarConfirmed !== null && <span style={{ color: C.blue }}>Cal: {ev.calendarConfirmed}</span>}
              </div>
            </Card>
          );
        })}
      </Section>
      {past.length > 0 && (
        <Section title="Recent Past">
          {past.map((ev, i) => (
            <Card key={i} style={{ opacity: 0.6 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{ev.clientName}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                {fmtDate(ev.date)}
                {ev.attendees !== null && ` · ✓ ${ev.attendees}`}
              </div>
            </Card>
          ))}
        </Section>
      )}
    </div>
  );
}

// ─── VAs TAB ──────────────────────────────────────────────────────────────────

function VAsTab({ attendance, setAttendance }: { attendance: AttendanceEntry[]; setAttendance: React.Dispatch<React.SetStateAction<AttendanceEntry[]>> }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ va: "Rosalie", date: new Date().toISOString().slice(0, 10), late: false, absent: false, ooz: false, notes: "" });
  const [saving, setSaving] = useState(false);

  const n = new Date();
  const viewDate = new Date(n.getFullYear(), n.getMonth() + monthOffset, 1);
  const m1 = viewDate.toISOString().slice(0, 10);
  const m2 = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toISOString().slice(0, 10);
  const monthLabel = viewDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const monthEntries = attendance.filter(e => e.date >= m1 && e.date <= m2);

  async function saveAtt() {
    setSaving(true);
    const res = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      const created = await res.json();
      setAttendance(a => [...a, created]);
      setShowForm(false);
      setForm({ va: "Rosalie", date: new Date().toISOString().slice(0, 10), late: false, absent: false, ooz: false, notes: "" });
    }
    setSaving(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px", flexShrink: 0 }}>
        <button onClick={() => setMonthOffset(o => o - 1)} style={{ padding: "8px 14px", background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 8, color: C.muted, fontSize: 16, cursor: "pointer" }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{monthLabel}</div>
        <button onClick={() => setMonthOffset(o => Math.min(0, o + 1))} style={{ padding: "8px 14px", background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 8, color: C.muted, fontSize: 16, cursor: "pointer" }}>›</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        {VAS.map(va => {
          const entries = monthEntries.filter(e => e.va === va);
          const lates = entries.filter(e => e.late).length;
          const absents = entries.filter(e => e.absent).length;
          const oozs = entries.filter(e => e.ooz).length;
          const strikes = Math.floor(lates / 3) + Math.floor(absents / 2);
          const color = VA_COLOR[va] ?? C.muted;
          return (
            <Card key={va} style={{ borderLeft: strikes >= 3 ? `3px solid ${C.red}` : `3px solid ${color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color }}>{va}</div>
                {strikes > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: strikes >= 3 ? C.red : C.amber, background: strikes >= 3 ? "rgba(255,77,106,0.12)" : "rgba(255,171,26,0.12)", padding: "2px 8px", borderRadius: 20 }}>{strikes} strike{strikes !== 1 ? "s" : ""}</span>}
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: lates > 0 ? C.amber : C.muted }}>{lates}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>Lates</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: absents > 0 ? C.red : C.muted }}>{absents}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>Absences</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: oozs > 0 ? C.purple : C.muted }}>{oozs}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>OOZ</div>
                </div>
              </div>
            </Card>
          );
        })}

        {/* Log button */}
        <button onClick={() => setShowForm(s => !s)} style={{ width: "100%", padding: "14px", borderRadius: 10, background: "rgba(75,163,255,0.12)", border: "1px solid rgba(75,163,255,0.25)", color: C.blue, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>
          {showForm ? "Cancel" : "+ Log Attendance"}
        </button>

        {showForm && (
          <Card style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>VA</label>
              <select value={form.va} onChange={e => setForm(f => ({ ...f, va: e.target.value }))} style={inp}>
                {VAS.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(["late", "absent", "ooz"] as const).map(key => (
                <button key={key} onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, textTransform: "capitalize",
                    background: form[key] ? (key === "late" ? "rgba(255,171,26,0.18)" : key === "absent" ? "rgba(255,77,106,0.18)" : "rgba(155,127,245,0.18)") : "transparent",
                    border: `1px solid ${form[key] ? (key === "late" ? C.amber : key === "absent" ? C.red : C.purple) : C.border2}`,
                    color: form[key] ? (key === "late" ? C.amber : key === "absent" ? C.red : C.purple) : C.muted }}>
                  {key === "ooz" ? "OOZ" : key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
            <input style={{ ...inp, marginBottom: 12 }} placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <button onClick={saveAtt} disabled={saving || (!form.late && !form.absent && !form.ooz)}
              style={{ width: "100%", padding: "13px", borderRadius: 10, background: "rgba(15,207,138,0.15)", border: "1px solid rgba(15,207,138,0.3)", color: C.green, fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: saving || (!form.late && !form.absent && !form.ooz) ? 0.5 : 1 }}>
              {saving ? "Saving…" : "Save Entry"}
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── ACTIVITY TAB ─────────────────────────────────────────────────────────────

function ActivityTab() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVa, setFilterVa] = useState("All");

  useEffect(() => {
    fetch("/api/activity").then(r => r.json()).then(d => {
      setLogs(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;

  const filtered = filterVa === "All" ? logs : logs.filter(l => l.va === filterVa);
  const recent = [...filtered].sort((a, b) => b.ts > a.ts ? 1 : -1).slice(0, 30);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "0 16px 10px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {["All", ...VAS].map(v => (
            <button key={v} onClick={() => setFilterVa(v)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, flexShrink: 0, cursor: "pointer",
              background: filterVa === v ? `${VA_COLOR[v] ?? "rgba(75,163,255"}0.18)` : "transparent",
              border: `1px solid ${filterVa === v ? (VA_COLOR[v] ?? C.blue) : C.border2}`,
              color: filterVa === v ? (VA_COLOR[v] ?? C.blue) : C.muted }}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        {recent.length === 0 && <EmptyState msg="No activity submissions yet" />}
        {recent.map(log => (
          <Card key={log.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{log.clientName}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  <span style={{ color: VA_COLOR[log.va] ?? C.muted }}>{log.va}</span> · {log.date}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
              {log.connReqSent > 0 && <span style={{ color: C.blue }}>Conn: {log.connReqSent}</span>}
              {log.inmailsSent > 0 && <span style={{ color: C.purple }}>InMail: {log.inmailsSent}</span>}
              {log.liEventInvites > 0 && <span style={{ color: C.amber }}>Events: {log.liEventInvites}</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

type TabId = "overview" | "clients" | "tasks" | "meeting" | "roundtable" | "vas" | "activity";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview",    label: "Home",       icon: "⌂" },
  { id: "clients",     label: "Clients",    icon: "👥" },
  { id: "tasks",       label: "Tasks",      icon: "✓" },
  { id: "meeting",     label: "Meeting",    icon: "📝" },
  { id: "roundtable",  label: "ERT",        icon: "📅" },
  { id: "vas",         label: "VAs",        icon: "👤" },
  { id: "activity",    label: "Activity",   icon: "📈" },
];

export default function MobilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) { router.push("/login"); return; }
      if (d.user.role === "admin") { router.push("/admin"); return; }
      setUser(d.user);
    });
    Promise.all([
      fetch("/api/clients").then(r => r.json()),
      fetch("/api/tasks").then(r => r.json()),
      fetch("/api/attendance").then(r => r.json()),
    ]).then(([c, t, a]) => {
      setClients(c?.clients ?? c ?? []);
      setTasks(t?.tasks ?? t ?? []);
      setAttendance(Array.isArray(a) ? a : []);
      setLoading(false);
    });
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const TAB_LABEL = TABS.find(t => t.id === tab);

  // Bottom tabs visible on screen (5 max — scroll the rest)
  const PRIMARY_TABS = TABS.slice(0, 5);
  const MORE_TABS = TABS.slice(5);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: C.bg, color: C.text, fontFamily: "'Inter', -apple-system, sans-serif", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", paddingTop: "calc(10px + env(safe-area-inset-top))", background: C.bg2, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <QCLCompact height={28} />
          {user && <div style={{ fontSize: 11, color: C.muted, borderLeft: `1px solid ${C.border}`, paddingLeft: 10 }}>{user.name}</div>}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/" style={{ fontSize: 12, color: C.muted, textDecoration: "none" }}>Desktop</a>
          <button onClick={logout} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", padding: "6px 0" }}>Sign out</button>
        </div>
      </div>

      {/* Tab title bar */}
      <div style={{ padding: "10px 16px 6px", background: C.bg, flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{TAB_LABEL?.icon} {TAB_LABEL?.label}</div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <QCLLoadingScreen />
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {tab === "overview"   && <OverviewTab clients={clients} tasks={tasks} setTasks={setTasks} onSwitchTab={(t) => setTab(t as TabId)} />}
          {tab === "clients"    && <ClientsTab clients={clients} setClients={setClients} />}
          {tab === "tasks"      && <TasksTab tasks={tasks} setTasks={setTasks} />}
          {tab === "meeting"    && <MeetingTab clients={clients} setTasks={setTasks} />}
          {tab === "roundtable" && <RoundtableTab />}
          {tab === "vas"        && <VAsTab attendance={attendance} setAttendance={setAttendance} />}
          {tab === "activity"   && <ActivityTab />}
        </div>
      )}

      {/* Bottom tab bar */}
      <div style={{ background: C.bg2, borderTop: `1px solid ${C.border}`, paddingBottom: "env(safe-area-inset-bottom)", flexShrink: 0, overflowX: "auto" }}>
        <div style={{ display: "flex", minWidth: "max-content", width: "100%" }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, minWidth: 60, padding: "10px 6px 8px", border: "none", cursor: "pointer", background: "transparent", borderTop: `2px solid ${active ? C.blue : "transparent"}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? C.blue : C.muted, whiteSpace: "nowrap" }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
