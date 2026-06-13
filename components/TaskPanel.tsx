"use client";
import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";
import type { Task } from "@/types";

function dueColor(due: string, D: { red: string; amber: string; muted: string }): string {
  if (!due) return D.muted;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return D.red;
  if (diff <= 1) return D.amber;
  return D.muted;
}

function fmtDue(due: string): string {
  if (!due) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function TaskPanel() {
  const { D } = useTheme();
  const accent = D.amber;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<"active" | "done">("active");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("task-refresh", handler);
    return () => window.removeEventListener("task-refresh", handler);
  }, []);

  async function load() {
    try {
      const data = await fetch("/api/tasks").then((r) => r.json());
      setTasks(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function addTask() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    load();
  }

  async function toggleDone(id: string, done: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !done }),
    });
    load();
  }

  async function cyclePriority(id: string, current: Task["priority"]) {
    const next: Task["priority"] = current === "normal" ? "important" : current === "important" ? "urgent" : "normal";
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: next }),
    });
    load();
  }

  async function removeTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = tasks.filter((t) => filter === "active" ? !t.done : t.done);
  const activeCount = tasks.filter((t) => !t.done).length;

  return (
    <div style={{ background: D.bg2, border: `1px solid ${accent}60`, borderRadius: 12, overflow: "hidden", boxShadow: `0 0 0 1px ${accent}15, 0 4px 20px ${accent}12` }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${accent}25`, background: `linear-gradient(135deg, ${accent}22 0%, ${accent}10 100%)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>✅</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>My Tasks</span>
          {activeCount > 0 && (
            <span style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}35`, borderRadius: 9, fontSize: 10, fontWeight: 700, padding: "0 6px", height: 17, display: "inline-flex", alignItems: "center" }}>
              {activeCount}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {(["active", "done"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 5,
              border: `1px solid ${filter === f ? accent + "50" : "transparent"}`,
              background: filter === f ? `${accent}15` : "none",
              color: filter === f ? accent : D.hint,
              cursor: "pointer", fontFamily: "inherit",
              fontWeight: filter === f ? 700 : 400,
              textTransform: "capitalize",
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Quick-add input */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${D.border}`, display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
          placeholder="Add a task… press Enter"
          style={{ flex: 1, height: 30, padding: "0 10px", fontSize: 12, borderRadius: 7, border: `1px solid ${D.border}`, background: D.bg3, color: D.text, outline: "none", fontFamily: "inherit" }}
        />
        <button
          onClick={addTask}
          disabled={!input.trim()}
          style={{
            height: 30, padding: "0 14px", borderRadius: 7, border: "none",
            background: input.trim() ? accent : D.bg3,
            color: input.trim() ? "#000" : D.hint,
            fontSize: 12, fontWeight: 700,
            cursor: input.trim() ? "pointer" : "default",
            fontFamily: "inherit", transition: "all 0.15s",
          }}
        >Add</button>
      </div>

      {/* Task list */}
      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        {loading && (
          <div style={{ padding: "16px", color: D.hint, fontSize: 12, textAlign: "center" }}>Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: "20px 16px", color: D.hint, fontSize: 12, textAlign: "center" }}>
            {filter === "done" ? "No completed tasks yet." : "No active tasks. Add one above or ask the AI."}
          </div>
        )}
        {filtered.map((t, i) => (
          <div
            key={t.id}
            className="qcl-row"
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 16px",
              borderTop: i > 0 ? `1px solid ${D.border}` : undefined,
              background: "transparent",
            }}
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggleDone(t.id, t.done)}
              style={{ cursor: "pointer", accentColor: accent, flexShrink: 0, width: 14, height: 14 }}
            />
            <button
              onClick={() => cyclePriority(t.id, t.priority)}
              title={t.priority === "normal" ? "Mark important" : t.priority === "important" ? "Mark urgent" : "Clear priority"}
              style={{
                flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                padding: "0 2px", lineHeight: 1, fontSize: 13,
                opacity: t.done ? 0.3 : 1,
              }}
            >
              {t.priority === "urgent"    && <span style={{ color: D.red   }}>!!</span>}
              {t.priority === "important" && <span style={{ color: D.amber }}>★</span>}
              {t.priority === "normal"    && <span style={{ color: D.border, fontSize: 10 }}>☆</span>}
            </button>
            <span style={{
              flex: 1, fontSize: 13,
              color: t.done ? D.hint : t.priority === "urgent" ? D.red : t.priority === "important" ? D.amber : D.text,
              textDecoration: t.done ? "line-through" : "none",
              fontWeight: t.priority === "urgent" ? 700 : t.priority === "important" ? 600 : 400,
              wordBreak: "break-word",
            }}>
              {t.text}
            </span>
            {t.dueDate && (
              <span style={{
                fontSize: 10, fontWeight: 600, flexShrink: 0,
                color: dueColor(t.dueDate, D),
                background: `${dueColor(t.dueDate, D)}18`,
                borderRadius: 4, padding: "1px 6px",
              }}>
                {fmtDue(t.dueDate)}
              </span>
            )}
            <button
              onClick={() => removeTask(t.id)}
              style={{ background: "none", border: "none", color: D.hint, cursor: "pointer", fontSize: 15, lineHeight: 1, opacity: 0.5, flexShrink: 0, padding: "0 2px" }}
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
