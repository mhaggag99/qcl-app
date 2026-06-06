"use client";
import React, { useState, useEffect, useRef } from "react";
import type { Client, MeetingDraft, MeetingActionItem } from "@/types";
import { useTheme } from "@/lib/theme";
import { uid } from "@/lib/utils";

const ACCENT = "#06b6d4";

export default function MeetingDraftPanel({ clients, onAddNote }: {
  clients: Client[];
  onAddNote: (clientId: string, text: string) => void;
}) {
  const { D } = useTheme();
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/meeting-draft")
      .then((r) => r.json())
      .then((d: MeetingDraft) => {
        setClientId(d.clientId || "");
        setNotes(d.notes || "");
        setActionItems(d.actionItems || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function scheduleSave(data: Partial<MeetingDraft>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch("/api/meeting-draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } catch {}
      setSaving(false);
    }, 800);
  }

  function handleClientChange(id: string) {
    const c = clients.find((c) => c.id === id);
    setClientId(id);
    scheduleSave({ clientId: id, clientName: c?.name || "" });
  }

  function handleNotesChange(val: string) {
    setNotes(val);
    scheduleSave({ notes: val });
  }

  function addActionItem() {
    const text = newItem.trim();
    if (!text) return;
    const updated = [...actionItems, { id: uid(), text, done: false }];
    setActionItems(updated);
    setNewItem("");
    scheduleSave({ actionItems: updated });
  }

  function toggleItem(id: string) {
    const updated = actionItems.map((i) => i.id === id ? { ...i, done: !i.done } : i);
    setActionItems(updated);
    scheduleSave({ actionItems: updated });
  }

  function deleteItem(id: string) {
    const updated = actionItems.filter((i) => i.id !== id);
    setActionItems(updated);
    scheduleSave({ actionItems: updated });
  }

  function flash(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 3000);
  }

  function saveAsNote() {
    if (!clientId || (!notes.trim() && !actionItems.length)) return;
    const parts: string[] = [];
    if (notes.trim()) parts.push(`Meeting notes:\n${notes.trim()}`);
    if (actionItems.length) parts.push(`Action items:\n${actionItems.map((i) => `${i.done ? "☑" : "☐"} ${i.text}`).join("\n")}`);
    onAddNote(clientId, parts.join("\n\n"));
    flash("Saved as client note");
  }

  async function pushToTasks() {
    const pending = actionItems.filter((i) => !i.done);
    if (!pending.length) return;
    const clientName = clients.find((c) => c.id === clientId)?.name || "";
    for (const item of pending) {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clientName ? `${clientName} - ${item.text}` : item.text }),
      });
    }
    window.dispatchEvent(new CustomEvent("task-refresh"));
    flash(`${pending.length} item${pending.length > 1 ? "s" : ""} added to task list`);
  }

  async function clearDraft() {
    if (!confirm("Clear this meeting draft?")) return;
    setNotes(""); setActionItems([]); setClientId(""); setActionMsg("");
    await fetch("/api/meeting-draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "", clientName: "", notes: "", actionItems: [] }),
    });
  }

  const hasContent = notes.trim().length > 0 || actionItems.length > 0;
  const pendingItems = actionItems.filter((i) => !i.done);

  if (!loaded) return null;

  return (
    <div style={{ background: D.bg2, border: `1px solid ${ACCENT}60`, borderRadius: 12, overflow: "hidden", boxShadow: `0 0 0 1px ${ACCENT}15, 0 4px 20px ${ACCENT}12` }}>

      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${ACCENT}25`, background: `linear-gradient(135deg, ${ACCENT}22 0%, ${ACCENT}10 100%)`, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>🗒️</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>Meeting Draft</span>
        {saving && <span style={{ fontSize: 10, color: `${ACCENT}70`, letterSpacing: "0.04em" }}>saving…</span>}
        <select
          value={clientId}
          onChange={(e) => handleClientChange(e.target.value)}
          style={{
            fontSize: 11, height: 26, padding: "0 8px", borderRadius: 7,
            border: `1px solid ${clientId ? ACCENT + "60" : D.border}`,
            background: clientId ? `${ACCENT}18` : D.bg3,
            color: clientId ? ACCENT : D.hint,
            fontFamily: "inherit", outline: "none", cursor: "pointer", maxWidth: 170,
          }}
        >
          <option value="">Select client…</option>
          {clients
            .filter((c) => c.status !== "Stopped")
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
          }
        </select>
      </div>

      {/* Notes */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: `${ACCENT}90`, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Notes</div>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Type anything discussed in the meeting…"
          rows={3}
          style={{
            width: "100%", resize: "vertical", boxSizing: "border-box",
            background: D.bg3, border: `1px solid ${D.border}`,
            borderRadius: 8, padding: "8px 10px",
            fontSize: 13, color: D.text, fontFamily: "inherit",
            lineHeight: 1.6, outline: "none",
          }}
          onFocus={(e) => { e.target.style.borderColor = `${ACCENT}50`; }}
          onBlur={(e) => { e.target.style.borderColor = D.border; }}
        />
      </div>

      {/* Action items */}
      <div style={{ padding: "10px 16px 0" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: `${ACCENT}90`, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Action Items</div>

        {/* Add input */}
        <div style={{ display: "flex", gap: 6, marginBottom: actionItems.length ? 6 : 0 }}>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addActionItem(); }}
            placeholder="Add an action item… press Enter"
            style={{ flex: 1, height: 30, padding: "0 10px", fontSize: 12, borderRadius: 7, border: `1px solid ${D.border}`, background: D.bg3, color: D.text, outline: "none", fontFamily: "inherit" }}
          />
          <button
            onClick={addActionItem}
            disabled={!newItem.trim()}
            style={{ height: 30, padding: "0 12px", borderRadius: 7, border: "none", background: newItem.trim() ? ACCENT : D.bg3, color: newItem.trim() ? "#000" : D.hint, fontSize: 12, fontWeight: 700, cursor: newItem.trim() ? "pointer" : "default", fontFamily: "inherit" }}
          >Add</button>
        </div>

        {/* Items */}
        {actionItems.length > 0 && (
          <div style={{ border: `1px solid ${D.border}`, borderRadius: 8, overflow: "hidden" }}>
            {actionItems.map((item, i) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderTop: i > 0 ? `1px solid ${D.border}` : undefined, background: item.done ? `${D.bg3}` : "transparent" }}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleItem(item.id)}
                  style={{ cursor: "pointer", accentColor: ACCENT, flexShrink: 0, width: 14, height: 14 }}
                />
                <span style={{ flex: 1, fontSize: 13, color: item.done ? D.hint : D.text, textDecoration: item.done ? "line-through" : "none" }}>
                  {item.text}
                </span>
                <button onClick={() => deleteItem(item.id)} style={{ background: "none", border: "none", color: D.hint, cursor: "pointer", fontSize: 15, lineHeight: 1, opacity: 0.5, flexShrink: 0, padding: "0 2px" }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px 14px", marginTop: 10, borderTop: `1px solid ${D.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {actionMsg
          ? <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>✓ {actionMsg}</span>
          : <span style={{ fontSize: 11, color: D.hint }}>{hasContent ? (clientId ? "" : "Select a client to save") : "No content yet"}</span>
        }
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button
            onClick={saveAsNote}
            disabled={!clientId || !hasContent}
            title={!clientId ? "Select a client first" : ""}
            style={{ height: 28, padding: "0 12px", borderRadius: 7, border: `1px solid ${ACCENT}40`, background: `${ACCENT}12`, color: clientId && hasContent ? ACCENT : D.hint, fontSize: 11, fontWeight: 600, cursor: clientId && hasContent ? "pointer" : "default", fontFamily: "inherit" }}
          >Save as note</button>
          <button
            onClick={pushToTasks}
            disabled={pendingItems.length === 0}
            style={{ height: 28, padding: "0 12px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.bg3, color: pendingItems.length ? D.text : D.hint, fontSize: 11, fontWeight: 600, cursor: pendingItems.length ? "pointer" : "default", fontFamily: "inherit" }}
          >Push to tasks{pendingItems.length > 0 ? ` (${pendingItems.length})` : ""}</button>
          <button
            onClick={clearDraft}
            disabled={!hasContent && !clientId}
            style={{ height: 28, padding: "0 10px", borderRadius: 7, border: `1px solid ${D.red}30`, background: "none", color: hasContent || clientId ? D.red : D.hint, fontSize: 11, fontWeight: 600, cursor: hasContent || clientId ? "pointer" : "default", fontFamily: "inherit", opacity: hasContent || clientId ? 0.75 : 0.4 }}
          >Clear</button>
        </div>
      </div>
    </div>
  );
}
