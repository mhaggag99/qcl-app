"use client";
import React, { useState, useEffect } from "react";
import type { Client, AttendanceEntry, Note, RoundtableEvent, ActivityRow } from "@/types";
import type { VAAttendanceEntry } from "@/lib/monday";
import { useTheme } from "@/lib/theme";
import { uid, tsNow, fmt } from "@/lib/utils";
import { B, Modal } from "./ui";
import ClientForm from "./ClientForm";
import AttForm from "./AttForm";
import Detail from "./Detail";
import QuickBar from "./QuickBar";
import Overview from "./Overview";
import Clients from "./Clients";
import RoundtableTab from "./RoundtableTab";
import VAsTab from "./VAsTab";
import MondayActivity from "./MondayActivity";
import ActivityTab from "./ActivityTab";
import UserSettingsModal from "./UserSettingsModal";
import DEMO from "@/lib/demo";

interface SessionUser { id: string; email: string; name: string; role: string; }

type ModalState = { type: string; id?: string } | null;

const ALL_TABS = [
  { id: "overview",   label: "Overview",          color: "#06b6d4" },
  { id: "clients",    label: "All Clients",        color: "#10b981" },
  { id: "roundtable", label: "Roundtable Status",  color: "#4ba3ff" },
  { id: "activity",   label: "Client Activity",    color: "#f97316" },
  { id: "vas",        label: "VA Tracker",         color: "#8b5cf6" },
];

const TABS = DEMO
  ? ALL_TABS.filter((t) => t.id !== "roundtable")
  : ALL_TABS;

export default function Dashboard() {
  const { D, toggle, isDark } = useTheme();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [tab, setTab] = useState("overview");
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rtData, setRtData] = useState<{ boardName: string; events: RoundtableEvent[] } | null>(null);
  const [rtLoading, setRtLoading] = useState(false);
  const [rtError, setRtError] = useState("");
  const [actData, setActData] = useState<{ boardName: string; rows: ActivityRow[] } | null>(null);
  const [actLoading, setActLoading] = useState(false);
  const [actError, setActError] = useState("");
  const [mondayAtt, setMondayAtt] = useState<VAAttendanceEntry[]>([]);
  const [mondayAttLoading, setMondayAttLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d.user) setUser(d.user); });
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/attendance").then((r) => r.json()),
    ]).then(([c, a]) => { setClients(c); setAttendance(a); setLoading(false); });
    loadRoundtable();
    loadMondayAtt();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function loadRoundtable() {
    setRtLoading(true); setRtError("");
    try {
      const res = await fetch("/api/monday/roundtable");
      const data = await res.json();
      if (!res.ok) {
        setRtError(data.error === "monday_not_configured" ? "Add your Monday API token in Settings to enable this." : "Could not load roundtable board.");
      } else { setRtData(data); }
    } catch { setRtError("Failed to connect to Monday."); }
    setRtLoading(false);
  }

  async function loadMondayAtt() {
    setMondayAttLoading(true);
    try {
      const res = await fetch("/api/monday/va-attendance");
      if (res.ok) setMondayAtt(await res.json());
    } catch { /* silent */ }
    setMondayAttLoading(false);
  }

  async function loadActivity() {
    setActLoading(true); setActError("");
    try {
      const res = await fetch("/api/monday/activity");
      const data = await res.json();
      if (!res.ok) {
        setActError(data.error === "monday_not_configured" ? "Add your Monday API token in Settings to enable this." : "Could not load activity board.");
      } else { setActData(data); }
    } catch { setActError("Failed to connect to Monday."); }
    setActLoading(false);
  }

  async function saveClient(f: Record<string, unknown>, id?: string) {
    const t = tsNow();
    if (id) {
      const existing = clients.find((c) => c.id === id);
      if (!existing) return;
      const notesToAppend: Note[] = [];
      if (f.message && f.message !== existing.message) notesToAppend.push({ id: uid(), type: "upd", text: "Outreach message updated.", ts: t });
      if (f.targeting && f.targeting !== existing.targeting) notesToAppend.push({ id: uid(), type: "upd", text: "Targeting filters updated.", ts: t });
      if (f.status && f.status !== existing.status) notesToAppend.push({ id: uid(), type: "upd", text: `Status changed to ${f.status}.`, ts: t });
      if (f.ert && f.ert !== existing.ert) notesToAppend.push({ id: uid(), type: "upd", text: `ERT rescheduled to ${fmt(f.ert as string)}.`, ts: t });
      if (f.note && (f.note as string).trim()) notesToAppend.push({ id: uid(), type: "gen", text: f.note as string, ts: t });

      const updated = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, attendees: parseInt(String(f.attendees)) || 0, registered: parseInt(String(f.registered)) || 0, notesToAppend }),
      }).then((r) => r.json());
      setClients((prev) => prev.map((c) => c.id === id ? updated : c));
    } else {
      const created = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, attendees: parseInt(String(f.attendees)) || 0, registered: parseInt(String(f.registered)) || 0 }),
      }).then((r) => r.json());
      setClients((prev) => [...prev, created]);
    }
    setModal(null);
  }

  async function handleAIAction({ type, clientId, fields, noteText, noteTitle, aiTagged }: {
    type: string; clientId: string; fields?: Record<string, unknown>; noteText?: string; noteTitle?: string; aiTagged?: boolean;
  }) {
    const t = tsNow();
    const existing = clients.find((c) => c.id === clientId);
    if (!existing) return;

    const notesToAppend: Note[] = [];
    if (type === "update" && fields) {
      const upds: string[] = [];
      if (fields.attendees !== undefined && fields.attendees !== existing.attendees) upds.push(`Attendees updated to ${fields.attendees}/20`);
      if (fields.status && fields.status !== existing.status) upds.push(`Status changed to ${fields.status}`);
      if (fields.ert && fields.ert !== existing.ert) upds.push(`ERT rescheduled to ${fmt(fields.ert as string)}`);
      if (fields.flag && fields.flag !== existing.flag) upds.push(`Flag set: ${fields.flag}`);
      if (fields.message && fields.message !== existing.message) upds.push("Outreach message updated");
      if (fields.targeting && fields.targeting !== existing.targeting) upds.push("Targeting updated");
      if (upds.length) notesToAppend.push({ id: uid(), type: "ai", text: "✦ AI: " + upds.join(", ") + ".", ts: t });
      if (noteText) notesToAppend.push({ id: uid(), type: "ai", text: noteText, ts: t });

      const updated = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, notesToAppend }),
      }).then((r) => r.json());
      setClients((prev) => prev.map((c) => c.id === clientId ? updated : c));
    } else if (type === "note" && noteText) {
      notesToAppend.push({ id: uid(), type: aiTagged ? "ai" : "gen", text: noteText, ts: t, ...(noteTitle ? { title: noteTitle } : {}) });
      const updated = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notesToAppend }),
      }).then((r) => r.json());
      setClients((prev) => prev.map((c) => c.id === clientId ? updated : c));
    }
  }

  async function deleteClient(id: string) {
    if (!confirm("Delete this client?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    setClients((prev) => prev.filter((c) => c.id !== id));
  }

  async function changeStatus(id: string, status: string) {
    const updated = await fetch(`/api/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => r.json());
    setClients((prev) => prev.map((c) => c.id === id ? updated : c));
  }

  async function addNote(id: string, text: string, title?: string) {
    const t = tsNow();
    const note: Note = { id: uid(), type: "gen", text, ts: t, ...(title ? { title } : {}) };
    const updated = await fetch(`/api/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notesToAppend: [note] }),
    }).then((r) => r.json());
    setClients((prev) => prev.map((c) => c.id === id ? updated : c));
  }

  async function toggleNote(clientId: string, noteId: string) {
    const existing = clients.find((c) => c.id === clientId);
    if (!existing) return;
    const notesReplace = existing.notes.map((n) => n.id === noteId ? { ...n, done: !n.done } : n);
    const updated = await fetch(`/api/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notesReplace }),
    }).then((r) => r.json());
    setClients((prev) => prev.map((c) => c.id === clientId ? updated : c));
  }

  async function deleteNote(clientId: string, noteId: string) {
    const existing = clients.find((c) => c.id === clientId);
    if (!existing) return;
    const notesReplace = existing.notes.filter((n) => n.id !== noteId);
    const updated = await fetch(`/api/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notesReplace }),
    }).then((r) => r.json());
    setClients((prev) => prev.map((c) => c.id === clientId ? updated : c));
  }

  async function saveAtt(f: Omit<AttendanceEntry, "id">) {
    const created = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    }).then((r) => r.json());
    setAttendance((prev) => [...prev, created]);
    setModal(null);
  }

  async function delAtt(id: string) {
    if (id.startsWith("monday-")) return; // Monday entries are read-only
    await fetch(`/api/attendance/${id}`, { method: "DELETE" });
    setAttendance((prev) => prev.filter((e) => e.id !== id));
  }

  const mc = modal?.id ? clients.find((c) => c.id === modal.id) : null;

  const TabBtn = ({ id, label, color }: { id: string; label: string; color: string }) => {
    const isActive = tab === id;
    const isHovered = hoveredTab === id;
    return (
      <button
        onClick={() => setTab(id)}
        onMouseEnter={() => setHoveredTab(id)}
        onMouseLeave={() => setHoveredTab(null)}
        className="qcl-tab"
        style={{
          padding: "7px 16px", borderRadius: 10,
          border: isActive ? `1px solid ${color}50` : "1px solid transparent",
          background: isActive
            ? `linear-gradient(135deg, ${color}22 0%, ${color}0d 100%)`
            : isHovered ? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)") : "transparent",
          color: isActive ? color : isHovered ? D.text : D.muted,
          fontSize: 13, fontWeight: isActive ? 600 : 400,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 7,
          boxShadow: isActive ? `0 4px 20px ${color}30, inset 0 1px 0 rgba(255,255,255,0.1)` : "none",
          transform: isActive ? "translateY(-1px)" : "translateY(0)",
          letterSpacing: isActive ? "-0.01em" : "0",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: isActive ? color : D.hint,
          boxShadow: isActive ? `0 0 7px ${color}` : "none",
          flexShrink: 0, transition: "all 0.2s", display: "inline-block",
        }} />
        {label}
      </button>
    );
  };

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#060810", gap: 22 }}>
      <div style={{ position: "relative", width: 52, height: 52 }}>
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{ animation: "hexRotate 8s linear infinite" }}>
          <path d="M26 4L46 15.5V36.5L26 48L6 36.5V15.5L26 4Z" stroke="url(#lg1)" strokeWidth="1.2" fill="none" strokeLinejoin="round" strokeDasharray="128" style={{ animation: "dashSpin 2.4s cubic-bezier(0.4,0,0.6,1) infinite" }} />
          <defs>
            <linearGradient id="lg1" x1="6" y1="4" x2="46" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4ba3ff" /><stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(135deg, #4ba3ff, #8b5cf6)", boxShadow: "0 0 10px rgba(75,163,255,0.6)", animation: "loadingPulse 1.4s ease-in-out infinite" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 11, color: "#4a6080", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.18em", animation: "loadingPulse 2s ease-in-out infinite" }}>INITIALIZING SYSTEM</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#4ba3ff", opacity: 0.4, animation: `ai-dot 1.4s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`qcl-grain${isDark ? " qcl-scanlines" : ""}`} style={{
      fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 14, color: D.text,
      background: isDark ? "#060810" : "#f4f6fb",
      minHeight: "100vh", display: "flex", flexDirection: "column",
    }}>
      {/* Ambient light blobs — dark mode only */}
      {isDark && <>
        <div className="qcl-blob-1" />
        <div className="qcl-blob-2" />
        <div className="qcl-blob-3" />
      </>}

      {/* Top accent bar */}
      <div style={{ height: 2, background: "linear-gradient(90deg, #06b6d4 0%, #10b981 25%, #4ba3ff 50%, #f97316 75%, #8b5cf6 100%)", flexShrink: 0, position: "relative", zIndex: 1 }} />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: 57,
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"}`,
        background: isDark ? "rgba(6,8,16,0.88)" : "rgba(244,246,251,0.96)",
        backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
        boxShadow: isDark ? "0 1px 0 rgba(255,255,255,0.03), 0 8px 40px rgba(0,0,0,0.4)" : "0 1px 0 rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.04)",
        flexShrink: 0, position: "sticky", top: 0, zIndex: 20,
      }}>
        {/* Left: logo mark + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          {/* Geometric logo mark */}
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: isDark
              ? "linear-gradient(135deg, rgba(75,163,255,0.14) 0%, rgba(139,92,246,0.14) 100%)"
              : "linear-gradient(135deg, rgba(75,163,255,0.1) 0%, rgba(139,92,246,0.1) 100%)",
            border: `1px solid ${isDark ? "rgba(75,163,255,0.22)" : "rgba(75,163,255,0.28)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: isDark ? "0 0 18px rgba(75,163,255,0.10), inset 0 1px 0 rgba(255,255,255,0.07)" : "none",
            animation: isDark ? "logoGlow 5s ease-in-out infinite" : "none",
          }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="url(#qclG)" strokeWidth="1.4" strokeLinejoin="round" />
              <defs>
                <linearGradient id="qclG" x1="2.5" y1="1.5" x2="13.5" y2="14.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4ba3ff" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Vertical divider */}
          <div style={{ width: 1, height: 22, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)", flexShrink: 0 }} />

          {/* Title + date */}
          <div>
            <div style={{
              fontSize: 15, fontWeight: 600, lineHeight: 1.2,
              fontFamily: "'Syne', sans-serif", letterSpacing: "-0.025em",
              background: isDark ? "linear-gradient(135deg, #c8d8f0 20%, #5baeff 100%)" : "none",
              WebkitBackgroundClip: isDark ? "text" : "unset",
              WebkitTextFillColor: isDark ? "transparent" : D.text,
              backgroundClip: isDark ? "text" : "unset",
            }}>QCL Project Manager</div>
            <div suppressHydrationWarning style={{
              fontSize: 10, color: D.muted, marginTop: 1,
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em",
            }}>
              {typeof window !== "undefined" ? new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).toUpperCase() : ""}
            </div>
          </div>

          {/* AI badge */}
          {!DEMO && <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em",
            background: isDark ? "rgba(155,127,245,0.10)" : D.aibg,
            color: D.purple, border: `1px solid ${D.purple}32`, borderRadius: 5,
            padding: "2.5px 8px",
            fontFamily: "'JetBrains Mono', monospace",
            WebkitTextFillColor: D.purple,
          }}>✦ AI</span>}
        </div>

        {/* Right: LIVE + theme toggle + settings + user + add client */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isDark && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 11px", borderRadius: 20,
              background: "rgba(15,207,138,0.06)",
              border: "1px solid rgba(15,207,138,0.16)",
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                background: "#0fcf8a",
                animation: "systemPulse 2.5s ease-in-out infinite",
              }} />
              <span style={{
                fontSize: 9.5, color: "#0fcf8a", fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em",
              }}>LIVE</span>
            </div>
          )}
          <button onClick={toggle} title={isDark ? "Switch to light mode" : "Switch to dark mode"} className="qcl-btn" style={{
            width: 32, height: 32, borderRadius: 8,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : D.border2}`,
            background: isDark ? "rgba(255,255,255,0.04)" : D.bg3,
            color: D.muted, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}>{isDark ? "☀" : "◑"}</button>

          {/* Settings */}
          <button onClick={() => setShowSettings(true)} title="Settings" className="qcl-btn qcl-ib" style={{
            width: 32, height: 32, borderRadius: 8,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : D.border2}`,
            background: isDark ? "rgba(255,255,255,0.04)" : D.bg3,
            color: D.muted, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, opacity: 0.7,
          }}>⚙</button>

          {/* User display + logout */}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                padding: "4px 10px", borderRadius: 8,
                background: isDark ? "rgba(75,163,255,0.08)" : D.bg3,
                border: `1px solid ${isDark ? "rgba(75,163,255,0.18)" : D.border}`,
                color: D.text, fontSize: 12, fontWeight: 500,
                maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{user.name}</div>
              <button onClick={logout} title="Sign out" className="qcl-btn qcl-ib" style={{
                padding: "5px 10px", borderRadius: 7,
                border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : D.border}`,
                background: "transparent",
                color: D.muted, cursor: "pointer", fontSize: 11, fontWeight: 500,
              }}>Sign out</button>
            </div>
          )}

          <a href="/mobile" title="Open mobile view" style={{
            width: 32, height: 32, borderRadius: 8,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : D.border2}`,
            background: isDark ? "rgba(255,255,255,0.04)" : D.bg3,
            color: D.muted, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            textDecoration: "none",
          }}>📱</a>

          <B primary sm onClick={() => setModal({ type: "add" })}>+ Add client</B>
        </div>
      </div>

      {/* Nav */}
      <div style={{
        display: "flex", gap: 4, padding: "10px 24px",
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : D.border}`,
        background: isDark ? "rgba(6,8,16,0.78)" : "rgba(244,246,251,0.94)",
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.03), 0 6px 32px rgba(0,0,0,0.35)" : "0 2px 12px rgba(0,0,0,0.05)",
        flexWrap: "wrap", position: "sticky", top: 57, zIndex: 19,
      }}>
        {TABS.map((t) => <TabBtn key={t.id} id={t.id} label={t.label} color={t.color} />)}
        {/* Active tab glow line at the bottom of nav */}
        {isDark && (
          <div key={tab} className="qcl-tab-indicator" style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 1, pointerEvents: "none",
            background: `linear-gradient(90deg, transparent 5%, ${TABS.find(t => t.id === tab)?.color ?? "#4ba3ff"}50 40%, ${TABS.find(t => t.id === tab)?.color ?? "#4ba3ff"}50 60%, transparent 95%)`,
            boxShadow: `0 0 12px ${TABS.find(t => t.id === tab)?.color ?? "#4ba3ff"}35`,
          }} />
        )}
      </div>

      {/* Content */}
      <div key={tab} className="qcl-tab-content" style={{ padding: "24px 28px 8px", flex: 1, minHeight: 0, position: "relative", zIndex: 1 }}>
        {tab === "overview" && <Overview clients={clients} rtData={rtData} setModal={setModal as (m: { type: string; id: string }) => void} onAddNote={addNote} />}
        {tab === "clients" && <Clients clients={clients} setModal={setModal as (m: { type: string; id: string }) => void} onDelete={deleteClient} onStatusChange={changeStatus} rtData={rtData} onRefreshRt={loadRoundtable} rtLoading={rtLoading} />}
        {tab === "roundtable" && <RoundtableTab clients={clients} data={rtData} loading={rtLoading} error={rtError} onLoad={loadRoundtable} />}
        {tab === "vas" && <VAsTab clients={clients} attendance={attendance} mondayAtt={mondayAtt} mondayAttLoading={mondayAttLoading} onRefreshMondayAtt={loadMondayAtt} setModal={setModal as (m: { type: string }) => void} onDelAtt={delAtt} />}
        {tab === "activity" && (DEMO
          ? <ActivityTab />
          : <MondayActivity clients={clients} data={actData} loading={actLoading} error={actError} onLoad={loadActivity} />
        )}
      </div>

      {!DEMO && <QuickBar clients={clients} onAction={handleAIAction} setModal={setModal} setTab={setTab} />}

      {showSettings && <UserSettingsModal userName={user?.name || ""} onClose={() => setShowSettings(false)} />}

      <Modal open={modal?.type === "add"} onClose={() => setModal(null)} title="Add client">
        <ClientForm onSave={(f) => saveClient(f as unknown as Record<string, unknown>)} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal?.type === "edit" && !!mc} onClose={() => setModal(null)} title="Edit client">
        {mc && <ClientForm init={mc} onSave={(f) => saveClient(f as unknown as Record<string, unknown>, modal!.id)} onClose={() => setModal(null)} />}
      </Modal>
      <Modal open={modal?.type === "view" && !!mc} onClose={() => setModal(null)} title={mc?.name || ""} wide>
        {mc && <Detail c={mc} onClose={() => setModal(null)} onEdit={(id) => setModal({ type: "edit", id })} onNote={addNote} onToggleNote={toggleNote} onDeleteNote={deleteNote} />}
      </Modal>
      <Modal open={modal?.type === "att"} onClose={() => setModal(null)} title="Log attendance entry">
        <AttForm onSave={saveAtt} onClose={() => setModal(null)} />
      </Modal>
    </div>
  );
}
