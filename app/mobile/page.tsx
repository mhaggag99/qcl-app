"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Client, Task, MeetingDraft, MeetingActionItem, Note } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  bg: "#0d1117", bg2: "#161b22", bg3: "#1c2128",
  border: "rgba(255,255,255,0.08)", border2: "rgba(255,255,255,0.14)",
  text: "#d8e3f5", muted: "rgba(216,227,245,0.45)",
  blue: "#4ba3ff", green: "#38ef7d", red: "#ff4d6a",
  amber: "#f59e0b", purple: "#9b7ff5",
};

const STATUS_COLORS: Record<string, string> = {
  "New Client": C.blue, "Performing": C.green,
  "Slow Generating": C.amber, "At Risk": C.red, "Stopped": C.muted,
};

const PRIORITY_COLORS: Record<string, string> = {
  normal: C.muted, important: C.amber, urgent: C.red,
};

function uid() { return Math.random().toString(36).slice(2, 11); }
function tsNow() {
  return new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", background: C.bg2,
  border: `1px solid ${C.border2}`, borderRadius: 10,
  color: C.text, fontSize: 15, outline: "none",
  boxSizing: "border-box",
};

const card: React.CSSProperties = {
  background: C.bg2, border: `1px solid ${C.border}`,
  borderRadius: 12, padding: "14px 16px", marginBottom: 10,
};

// ─── Clients Tab ──────────────────────────────────────────────────────────────

function ClientsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(d => setClients(d.clients ?? []));
  }, []);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.va || "").toLowerCase().includes(search.toLowerCase())
  );

  async function addNote() {
    if (!selected || !noteText.trim()) return;
    setAddingNote(true);
    const note: Note = { id: uid(), type: "gen", text: noteText.trim(), ts: tsNow() };
    const res = await fetch(`/api/clients/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notesToAppend: [note] }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelected(updated.client);
      setClients(cs => cs.map(c => c.id === updated.client.id ? updated.client : c));
      setNoteText("");
    }
    setAddingNote(false);
  }

  // ── Detail view ──
  if (selected) {
    const recentNotes = [...(selected.notes ?? [])].reverse().slice(0, 8);
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "0 16px 12px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.blue, fontSize: 15, padding: "8px 0", cursor: "pointer" }}>
            ← Back
          </button>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{selected.name}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${STATUS_COLORS[selected.status] ?? C.muted}18`, border: `1px solid ${STATUS_COLORS[selected.status] ?? C.muted}35`, color: STATUS_COLORS[selected.status] ?? C.muted }}>
              {selected.status}
            </span>
            {selected.va && <span style={{ fontSize: 12, color: C.muted, padding: "3px 8px", background: C.bg3, borderRadius: 20 }}>👤 {selected.va}</span>}
            {selected.ert && <span style={{ fontSize: 12, color: C.muted, padding: "3px 8px", background: C.bg3, borderRadius: 20 }}>📅 {selected.ert}</span>}
            {selected.attendees > 0 && <span style={{ fontSize: 12, color: C.blue, padding: "3px 8px", background: C.bg3, borderRadius: 20 }}>✓ {selected.attendees} attending</span>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {/* Add note */}
          <div style={{ marginBottom: 16 }}>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              style={{ ...inp, resize: "none" }}
            />
            <button
              onClick={addNote}
              disabled={addingNote || !noteText.trim()}
              style={{
                marginTop: 8, width: "100%", padding: "11px",
                background: noteText.trim() ? "rgba(75,163,255,0.15)" : C.bg3,
                border: `1px solid ${noteText.trim() ? "rgba(75,163,255,0.35)" : C.border}`,
                borderRadius: 10, color: noteText.trim() ? C.blue : C.muted,
                fontSize: 15, fontWeight: 600, cursor: noteText.trim() ? "pointer" : "default",
              }}
            >{addingNote ? "Saving…" : "Add Note"}</button>
          </div>

          {/* Notes list */}
          {recentNotes.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>Notes</div>
              {recentNotes.map(n => (
                <div key={n.id} style={{ ...card, marginBottom: 8 }}>
                  <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{n.ts}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
        <input style={inp} placeholder="Search clients or VA…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: C.muted, paddingTop: 40, fontSize: 14 }}>No clients found</div>
        )}
        {filtered.map(c => (
          <div key={c.id} style={{ ...card, cursor: "pointer", borderLeft: c.redzone ? `3px solid ${C.red}` : `3px solid transparent` }} onClick={() => setSelected(c)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${STATUS_COLORS[c.status] ?? C.muted}18`, color: STATUS_COLORS[c.status] ?? C.muted, flexShrink: 0, marginLeft: 8 }}>
                {c.status}
              </span>
            </div>
            <div style={{ marginTop: 4, display: "flex", gap: 12, fontSize: 12, color: C.muted }}>
              {c.va && <span>👤 {c.va}</span>}
              {c.ert && <span>📅 {c.ert}</span>}
              {c.attendees > 0 && <span style={{ color: C.blue }}>✓ {c.attendees}</span>}
            </div>
            {c.flag && <div style={{ marginTop: 6, fontSize: 12, color: C.amber }}>⚑ {c.flag}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch("/api/tasks").then(r => r.json()).then(d => setTasks(d.tasks ?? []));
  }, []);

  async function addTask() {
    if (!newTask.trim()) return;
    setAdding(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newTask.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setTasks(ts => [d.task, ...ts]);
      setNewTask("");
    }
    setAdding(false);
  }

  async function toggleTask(task: Task) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    if (res.ok) {
      setTasks(ts => ts.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
    }
  }

  const active = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inp, flex: 1 }}
            placeholder="Add a task…"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTask()}
          />
          <button
            onClick={addTask}
            disabled={adding || !newTask.trim()}
            style={{ padding: "11px 18px", borderRadius: 10, background: "rgba(75,163,255,0.15)", border: "1px solid rgba(75,163,255,0.3)", color: C.blue, fontSize: 15, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
          >Add</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
        {active.length === 0 && done.length === 0 && (
          <div style={{ textAlign: "center", color: C.muted, paddingTop: 40, fontSize: 14 }}>No tasks yet</div>
        )}
        {active.map(t => (
          <div key={t.id} style={{ ...card, display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              onClick={() => toggleTask(t)}
              style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${PRIORITY_COLORS[t.priority]}`, flexShrink: 0, marginTop: 1, cursor: "pointer", background: "transparent" }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, color: C.text }}>{t.text}</div>
              {t.dueDate && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Due {t.dueDate}</div>}
            </div>
            {t.priority !== "normal" && (
              <span style={{ fontSize: 11, fontWeight: 700, color: PRIORITY_COLORS[t.priority], flexShrink: 0 }}>
                {t.priority === "urgent" ? "!!" : "★"}
              </span>
            )}
          </div>
        ))}
        {done.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: C.muted, margin: "16px 0 8px" }}>Done ({done.length})</div>
            {done.map(t => (
              <div key={t.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, opacity: 0.5 }}>
                <div
                  onClick={() => toggleTask(t)}
                  style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${C.green}`, flexShrink: 0, cursor: "pointer", background: "rgba(56,239,125,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <span style={{ color: C.green, fontSize: 12 }}>✓</span>
                </div>
                <div style={{ fontSize: 15, color: C.muted, textDecoration: "line-through" }}>{t.text}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Meeting Tab ──────────────────────────────────────────────────────────────

function MeetingTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [draft, setDraft] = useState<MeetingDraft>({ clientId: "", clientName: "", notes: "", actionItems: [], updatedAt: "" });
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [pushed, setPushed] = useState(false);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(d => setClients(d.clients ?? []));
    fetch("/api/meeting-draft").then(r => r.json()).then(d => { if (d.draft) setDraft(d.draft); });
  }, []);

  async function saveDraft(updated: MeetingDraft) {
    setSaving(true);
    await fetch("/api/meeting-draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setSaving(false);
  }

  function updateNotes(notes: string) {
    const updated = { ...draft, notes };
    setDraft(updated);
    saveDraft(updated);
  }

  function selectClient(clientId: string) {
    const c = clients.find(c => c.id === clientId);
    const updated = { ...draft, clientId, clientName: c?.name ?? "" };
    setDraft(updated);
    saveDraft(updated);
  }

  function addItem() {
    if (!newItem.trim()) return;
    const item: MeetingActionItem = { id: uid(), text: newItem.trim(), done: false };
    const updated = { ...draft, actionItems: [...draft.actionItems, item] };
    setDraft(updated);
    saveDraft(updated);
    setNewItem("");
  }

  function toggleItem(id: string) {
    const updated = { ...draft, actionItems: draft.actionItems.map(i => i.id === id ? { ...i, done: !i.done } : i) };
    setDraft(updated);
    saveDraft(updated);
  }

  async function pushToTasks() {
    const undone = draft.actionItems.filter(i => !i.done);
    if (!undone.length) return;
    for (const item of undone) {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.clientName ? `${draft.clientName} — ${item.text}` : item.text }),
      });
    }
    setPushed(true);
    setTimeout(() => setPushed(false), 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", padding: "0 16px 16px" }}>
      {/* Client selector */}
      <div style={{ marginBottom: 12 }}>
        <select
          value={draft.clientId}
          onChange={e => selectClient(e.target.value)}
          style={{ ...inp, color: draft.clientId ? C.text : C.muted }}
        >
          <option value="">Select client…</option>
          {clients.filter(c => c.status !== "Stopped").map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>Meeting Notes</div>
        <textarea
          value={draft.notes}
          onChange={e => updateNotes(e.target.value)}
          placeholder="Notes from the meeting…"
          rows={5}
          style={{ ...inp, resize: "none", lineHeight: 1.6 }}
        />
        {saving && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Saving…</div>}
      </div>

      {/* Action items */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>Action Items</div>
        {draft.actionItems.map(item => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div
              onClick={() => toggleItem(item.id)}
              style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${item.done ? C.green : C.border2}`, flexShrink: 0, cursor: "pointer", background: item.done ? "rgba(56,239,125,0.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {item.done && <span style={{ color: C.green, fontSize: 12 }}>✓</span>}
            </div>
            <span style={{ fontSize: 14, color: item.done ? C.muted : C.text, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input style={{ ...inp, flex: 1 }} placeholder="Add action item…" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} />
          <button onClick={addItem} style={{ padding: "11px 16px", borderRadius: 10, background: "rgba(75,163,255,0.12)", border: "1px solid rgba(75,163,255,0.25)", color: C.blue, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>+</button>
        </div>
      </div>

      {/* Push to tasks */}
      {draft.actionItems.some(i => !i.done) && (
        <button
          onClick={pushToTasks}
          style={{ width: "100%", padding: "12px", borderRadius: 10, background: pushed ? "rgba(56,239,125,0.12)" : "rgba(155,127,245,0.12)", border: `1px solid ${pushed ? "rgba(56,239,125,0.3)" : "rgba(155,127,245,0.3)"}`, color: pushed ? C.green : C.purple, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >{pushed ? "✓ Pushed to Tasks" : "Push to Tasks"}</button>
      )}
    </div>
  );
}

// ─── Main mobile page ─────────────────────────────────────────────────────────

type Tab = "clients" | "tasks" | "meeting";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "clients", label: "Clients", icon: "👥" },
  { id: "tasks",   label: "Tasks",   icon: "✓" },
  { id: "meeting", label: "Meeting", icon: "📝" },
];

export default function MobilePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("clients");
  const [user, setUser] = useState<{ name: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) { router.push("/login"); return; }
      if (d.user.role === "admin") { router.push("/admin"); return; }
      setUser(d.user);
    });
  }, [router]);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: C.bg, color: C.text, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", paddingTop: "calc(12px + env(safe-area-inset-top))", background: C.bg2, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #4ba3ff, #9b7ff5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>Q</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>QCL</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user && <span style={{ fontSize: 12, color: C.muted }}>{user.name}</span>}
          <a href="/" style={{ fontSize: 12, color: C.blue, textDecoration: "none" }}>Desktop →</a>
        </div>
      </div>

      {/* Tab title */}
      <div style={{ padding: "10px 16px 8px", background: C.bg, flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "clients" && <ClientsTab />}
        {tab === "tasks"   && <TasksTab />}
        {tab === "meeting" && <MeetingTab />}
      </div>

      {/* Bottom tab bar */}
      <div style={{ display: "flex", background: C.bg2, borderTop: `1px solid ${C.border}`, paddingBottom: "env(safe-area-inset-bottom)", flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "12px 0", border: "none", cursor: "pointer",
              background: "transparent",
              borderTop: `2px solid ${tab === t.id ? C.blue : "transparent"}`,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}
          >
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: tab === t.id ? C.blue : C.muted }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
