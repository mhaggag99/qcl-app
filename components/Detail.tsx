"use client";
import React, { useState } from "react";
import type { Client } from "@/types";
import { useTheme } from "@/lib/theme";
import type { Palette } from "@/lib/constants";
import { fmt, daysTo } from "@/lib/utils";
import { B, Pill, VaChip, SPill, LiPill, Prog, inp } from "./ui";
import EmailsPanel from "./EmailsPanel";

const QUICK_TITLES = ["Next Meeting", "Follow Up", "Action Item", "General"];

const DS = ({ title, children, D }: { title: string; children: React.ReactNode; D: Palette }) => (
  <div style={{ background: D.bg3, border: `1px solid ${D.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: D.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{title}</div>
    {children}
  </div>
);

const KV = ({ k, v, D }: { k: string; v: React.ReactNode; D: Palette }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${D.border}`, fontSize: 13 }}>
    <span style={{ color: D.muted }}>{k}</span><span>{v}</span>
  </div>
);

export default function Detail({ c, onClose, onEdit, onNote, onToggleNote, onDeleteNote }: {
  c: Client;
  onClose: () => void;
  onEdit: (id: string) => void;
  onNote: (id: string, text: string, title?: string) => void;
  onToggleNote: (id: string, noteId: string) => void;
  onDeleteNote: (id: string, noteId: string) => void;
}) {
  const { D } = useTheme();
  const [tab, setTab] = useState<"info" | "emails">("info");
  const [noteText, setNoteText] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [postMonday, setPostMonday] = useState(false);
  const [mondayStatus, setMondayStatus] = useState<{ ok: boolean; bubble: string } | null>(null);
  const [notePosting, setNotePosting] = useState<Record<string, "client" | "mcl">>({});
  const [noteResults, setNoteResults] = useState<Record<string, { target: string; ok: boolean; bubble: string; error?: string }>>({});
  const d = daysTo(c.ert);
  const dc = d === null ? D.muted : d <= 7 ? D.red : d <= 14 ? D.amber : D.green;

  const allNotes = c.notes || [];
  const activeNotes = [...allNotes].filter((n) => !n.done).reverse();
  const doneNotes = [...allNotes].filter((n) => n.done).reverse();
  const notes = [...activeNotes, ...doneNotes];

  async function postNoteToMonday(note: import("@/types").Note, target: "client" | "mcl") {
    setNotePosting((p) => ({ ...p, [note.id]: target }));
    const full = note.title ? `${note.title}: ${note.text}` : note.text;
    const res = await fetch("/api/monday/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName: c.name, noteText: full, target }),
    }).then((r) => r.json());
    setNotePosting((p) => { const n = { ...p }; delete n[note.id]; return n; });
    setNoteResults((r) => ({ ...r, [note.id]: { target, ok: res.ok, bubble: res.bubble || target, error: res.error } }));
    setTimeout(() => setNoteResults((r) => { const n = { ...r }; delete n[note.id]; return n; }), 5000);
  }

  async function submitNote() {
    if (!noteText.trim()) return;
    const text = noteText.trim();
    const title = noteTitle.trim() || undefined;
    onNote(c.id, text, title);
    setNoteText("");
    setNoteTitle("");
    setMondayStatus(null);
    if (postMonday) {
      const full = title ? `${title}: ${text}` : text;
      const res = await fetch("/api/monday/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: c.name, noteText: full }),
      }).then((r) => r.json());
      setMondayStatus({ ok: res.ok, bubble: res.bubble || "General" });
      setTimeout(() => setMondayStatus(null), 5000);
    }
  }

  const tabBtn = (t: "info" | "emails", label: React.ReactNode) => (
    <button onClick={() => setTab(t)} style={{
      padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: tab === t ? 600 : 400,
      border: `1px solid ${tab === t ? D.border : "transparent"}`,
      background: tab === t ? D.bg3 : "transparent",
      color: tab === t ? D.text : D.muted,
      cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
    }}>{label}</button>
  );

  return (
    <>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: `1px solid ${D.border}`, paddingBottom: 8 }}>
        {tabBtn("info", "Info & Notes")}
        {tabBtn("emails", (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
            </svg>
            Emails
          </span>
        ))}
      </div>

      {tab === "emails" && (
        <EmailsPanel c={c} onAddNote={(text) => onNote(c.id, text)} />
      )}

      {tab === "info" && <>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
        <SPill s={c.status} />
        <VaChip va={c.va} />
        {c.redzone && <Pill color="red">● RedZone</Pill>}
        {c.li && <LiPill li={c.li} />}
        {c.flag && <Pill color="amber">⚑ {c.flag}</Pill>}
      </div>

      <DS D={D} title="ERT & progress">
        <KV D={D} k="Next ERT" v={fmt(c.ert) + (c.ertTime ? " " + c.ertTime : "")} />
        <KV D={D} k="Days to ERT" v={<span style={{ color: dc, fontWeight: 600 }}>{d !== null ? d + " days" : "—"}</span>} />
        <KV D={D} k="Attendees confirmed" v={<Prog val={c.attendees || 0} />} />
        <KV D={D} k="Registered" v={c.registered || 0} />
        <KV D={D} k="Start date" v={c.start || "—"} />
        <KV D={D} k="Email" v={c.email || "—"} />
      </DS>

      {c.message && (
        <DS D={D} title="Outreach message">
          <div style={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 6, padding: "9px 11px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {c.message}
          </div>
        </DS>
      )}

      {c.targeting && (
        <DS D={D} title="Targeting filters">
          <div style={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 6, padding: "9px 11px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {c.targeting}
          </div>
        </DS>
      )}

      <DS D={D} title="Notes & log">
        {/* Note list */}
        <div style={{ marginBottom: 12, maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {!notes.length
            ? <div style={{ color: D.hint, fontSize: 12 }}>No notes yet.</div>
            : notes.map((n, i) => {
              const isFirstDone = !!n.done && (i === 0 || !notes[i - 1].done);
              const borderColor = n.done ? D.hint : n.type === "upd" ? D.blue : n.type === "ai" ? D.purple : D.border2;
              return (
                <React.Fragment key={n.id}>
                  {isFirstDone && activeNotes.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
                      <div style={{ flex: 1, height: 1, background: D.border }} />
                      <span style={{ fontSize: 10, color: D.hint, textTransform: "uppercase", letterSpacing: 0.5 }}>Completed</span>
                      <div style={{ flex: 1, height: 1, background: D.border }} />
                    </div>
                  )}
                  <div style={{ background: D.bg2, borderRadius: 6, padding: "8px 10px", borderLeft: `2px solid ${borderColor}`, opacity: n.done ? 0.55 : 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!n.done}
                        onChange={() => onToggleNote(c.id, n.id)}
                        style={{ marginTop: 2, cursor: "pointer", accentColor: D.green, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {n.title && (
                          <div style={{ fontWeight: 600, fontSize: 12, color: n.done ? D.hint : D.text, marginBottom: 2, textDecoration: n.done ? "line-through" : "none" }}>
                            {n.title}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: n.done ? D.hint : D.text, textDecoration: n.done ? "line-through" : "none", wordBreak: "break-word" }}>
                          {n.text}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, gap: 6 }}>
                          <span style={{ fontSize: 11, color: D.hint }}>
                            {n.ts}
                            {n.type === "ai" && <span style={{ marginLeft: 6, color: D.purple }}>✦ AI</span>}
                          </span>
                          {/* Per-note Monday post buttons */}
                          {noteResults[n.id] ? (
                            <span style={{ fontSize: 10, color: noteResults[n.id].ok ? "#FF7D4F" : D.red }} title={noteResults[n.id].error || ""}>
                              {noteResults[n.id].ok
                                ? `✓ → ${noteResults[n.id].target === "mcl" ? "MCL" : noteResults[n.id].bubble}`
                                : `⚠ ${noteResults[n.id].error || "Failed"}`}
                            </span>
                          ) : (
                            <div style={{ display: "flex", gap: 4 }}>
                              {(["client", "mcl"] as const).map((target) => {
                                const busy = notePosting[n.id] === target;
                                return (
                                  <button
                                    key={target}
                                    onClick={() => postNoteToMonday(n, target)}
                                    disabled={!!notePosting[n.id]}
                                    title={target === "mcl" ? "Post to Master Client List" : "Post to client's Monday board"}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 3,
                                      height: 22, padding: "0 7px", borderRadius: 5,
                                      border: `1px solid ${busy ? "#FF7D4F60" : D.border}`,
                                      background: busy ? "#FF7D4F12" : D.bg3,
                                      cursor: notePosting[n.id] ? "default" : "pointer",
                                      opacity: notePosting[n.id] && !busy ? 0.4 : 1,
                                      transition: "all 0.15s",
                                    }}
                                  >
                                    <svg width="18" height="7" viewBox="0 0 44 20" fill="none">
                                      <ellipse cx="6"  cy="10" rx="6" ry="6" fill={busy ? "#FF3D57" : "#FF3D5766"} />
                                      <ellipse cx="22" cy="10" rx="6" ry="6" fill={busy ? "#FF7D4F" : "#FF7D4F66"} />
                                      <ellipse cx="38" cy="10" rx="6" ry="6" fill={busy ? "#FFCB00" : "#FFCB0066"} />
                                    </svg>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: busy ? "#FF7D4F" : D.hint, letterSpacing: "0.03em" }}>
                                      {busy ? "…" : target === "mcl" ? "MCL" : "Board"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteNote(c.id, n.id)}
                        style={{ background: "none", border: "none", color: D.hint, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0, opacity: 0.6 }}
                        title="Delete note"
                      >×</button>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          }
        </div>

        {/* Add note form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {QUICK_TITLES.map((t) => (
              <button
                key={t}
                onClick={() => setNoteTitle(noteTitle === t ? "" : t)}
                style={{
                  fontSize: 11, padding: "2px 9px", borderRadius: 10, fontFamily: "inherit",
                  border: `1px solid ${noteTitle === t ? D.blue : D.border}`,
                  background: noteTitle === t ? D.bbg : "none",
                  color: noteTitle === t ? D.blue : D.muted,
                  cursor: "pointer",
                }}
              >{t}</button>
            ))}
          </div>
          <input
            style={{ ...inp, height: 30, padding: "0 9px", fontSize: 12 }}
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Title (optional)"
          />
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <input
              style={{ ...inp, flex: 1, height: 33, padding: "0 9px" }}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
              onKeyDown={(e) => { if (e.key === "Enter" && noteText.trim()) submitNote(); }}
            />
            {/* Monday toggle */}
            <button
              onClick={() => setPostMonday((v) => !v)}
              title={postMonday ? "Will also post to Monday" : "Click to also post to Monday"}
              style={{
                height: 33, padding: "0 10px", borderRadius: 8, flexShrink: 0,
                border: `1px solid ${postMonday ? "#FF7D4F" : D.border}`,
                background: postMonday ? "#FF7D4F18" : D.bg3,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.15s",
              }}
            >
              <svg width="28" height="10" viewBox="0 0 44 20" fill="none">
                <ellipse cx="6"  cy="10" rx="6" ry="6" fill={postMonday ? "#FF3D57" : "#FF3D5766"} />
                <ellipse cx="22" cy="10" rx="6" ry="6" fill={postMonday ? "#FF7D4F" : "#FF7D4F66"} />
                <ellipse cx="38" cy="10" rx="6" ry="6" fill={postMonday ? "#FFCB00" : "#FFCB0066"} />
              </svg>
            </button>
            <B primary sm onClick={submitNote}>Add</B>
          </div>
          {/* Monday post status */}
          {mondayStatus && (
            <div style={{ fontSize: 11, color: mondayStatus.ok ? "#FF7D4F" : D.red, marginTop: 2 }}>
              {mondayStatus.ok
                ? `✓ Posted to Monday → ${mondayStatus.bubble}`
                : `⚠ Monday post failed`}
            </div>
          )}
        </div>
      </DS>

      <div style={{ marginTop: 8 }}>
        <B sm onClick={() => { onClose(); setTimeout(() => onEdit(c.id), 50); }}>✏ Edit client</B>
      </div>
      </>}
    </>
  );
}
