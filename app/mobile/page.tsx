"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { uid, tsNow, fmt } from "@/lib/utils";
import { B, Modal } from "@/components/ui";
import type { Client, AttendanceEntry, Note, RoundtableEvent, ActivityRow } from "@/types";
import type { VAAttendanceEntry } from "@/lib/monday";
import DEMO from "@/lib/demo";

// Desktop components — reused as-is
import Overview       from "@/components/Overview";
import Clients        from "@/components/Clients";
import RoundtableTab  from "@/components/RoundtableTab";
import VAsTab         from "@/components/VAsTab";
import MondayActivity from "@/components/MondayActivity";
import ActivityTab    from "@/components/ActivityTab";
import ClientForm     from "@/components/ClientForm";
import AttForm        from "@/components/AttForm";
import Detail         from "@/components/Detail";
import QuickBar       from "@/components/QuickBar";
import UserSettingsModal from "@/components/UserSettingsModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionUser { id: string; email: string; name: string; role: string; }
type ModalState = { type: string; id?: string } | null;
type Tab = "overview" | "clients" | "roundtable" | "activity" | "vas";

const ALL_TABS: { id: Tab; label: string; icon: string; color: string }[] = [
  { id: "overview",   label: "Overview",    icon: "📊", color: "#06b6d4" },
  { id: "clients",    label: "Clients",     icon: "👥", color: "#10b981" },
  { id: "roundtable", label: "Roundtable",  icon: "🔄", color: "#4ba3ff" },
  { id: "activity",   label: "Activity",    icon: "📈", color: "#f97316" },
  { id: "vas",        label: "VAs",         icon: "👤", color: "#8b5cf6" },
];

const TABS = DEMO ? ALL_TABS.filter(t => t.id !== "roundtable") : ALL_TABS;

// ─── Main mobile page ─────────────────────────────────────────────────────────

export default function MobilePage() {
  const router = useRouter();
  const { D, toggle, isDark } = useTheme();

  // ── Auth ──
  const [user, setUser] = useState<SessionUser | null>(null);

  // ── Data ──
  const [clients,    setClients]    = useState<Client[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [loading,    setLoading]    = useState(true);

  // ── Tabs / UI ──
  const [tab,          setTab]         = useState<Tab>("overview");
  const [modal,        setModal]       = useState<ModalState>(null);
  const [showSettings, setShowSettings]= useState(false);

  // ── Monday / external data ──
  const [rtData,    setRtData]    = useState<{ boardName: string; events: RoundtableEvent[] } | null>(null);
  const [rtLoading, setRtLoading] = useState(false);
  const [rtError,   setRtError]   = useState("");
  const [actData,    setActData]   = useState<{ boardName: string; rows: ActivityRow[] } | null>(null);
  const [actLoading, setActLoading]= useState(false);
  const [actError,   setActError]  = useState("");
  const [mondayAtt,        setMondayAtt]       = useState<VAAttendanceEntry[]>([]);
  const [mondayAttLoading, setMondayAttLoading]= useState(false);

  // ── Bootstrap ──
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) { router.push("/login"); return; }
      setUser(d.user);
    });
    Promise.all([
      fetch("/api/clients").then(r => r.json()),
      fetch("/api/attendance").then(r => r.json()),
    ]).then(([c, a]) => {
      setClients(c?.clients ?? c ?? []);
      setAttendance(Array.isArray(a) ? a : []);
      setLoading(false);
    });
    loadRoundtable();
    loadMondayAtt();
  }, []);

  // ── External data loaders ──
  async function loadRoundtable() {
    setRtLoading(true); setRtError("");
    try {
      const res  = await fetch("/api/monday/roundtable");
      const data = await res.json();
      if (!res.ok) {
        setRtError(data.error === "monday_not_configured"
          ? "Add your Monday API token in Settings to enable this."
          : "Could not load roundtable board.");
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
      const res  = await fetch("/api/monday/activity");
      const data = await res.json();
      if (!res.ok) {
        setActError(data.error === "monday_not_configured"
          ? "Add your Monday API token in Settings to enable this."
          : "Could not load activity board.");
      } else { setActData(data); }
    } catch { setActError("Failed to connect to Monday."); }
    setActLoading(false);
  }

  // ── Auth actions ──
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  // ── Client CRUD ──
  async function saveClient(f: Record<string, unknown>, id?: string) {
    const t = tsNow();
    if (id) {
      const existing = clients.find(c => c.id === id);
      if (!existing) return;
      const notesToAppend: Note[] = [];
      if (f.message   && f.message   !== existing.message)   notesToAppend.push({ id: uid(), type: "upd", text: "Outreach message updated.", ts: t });
      if (f.targeting && f.targeting !== existing.targeting) notesToAppend.push({ id: uid(), type: "upd", text: "Targeting filters updated.", ts: t });
      if (f.status    && f.status    !== existing.status)    notesToAppend.push({ id: uid(), type: "upd", text: `Status changed to ${f.status}.`, ts: t });
      if (f.ert       && f.ert       !== existing.ert)       notesToAppend.push({ id: uid(), type: "upd", text: `ERT rescheduled to ${fmt(f.ert as string)}.`, ts: t });
      if (f.note && (f.note as string).trim()) notesToAppend.push({ id: uid(), type: "gen", text: f.note as string, ts: t });
      const updated = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, attendees: parseInt(String(f.attendees)) || 0, registered: parseInt(String(f.registered)) || 0, notesToAppend }),
      }).then(r => r.json());
      setClients(prev => prev.map(c => c.id === id ? updated : c));
    } else {
      const created = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, attendees: parseInt(String(f.attendees)) || 0, registered: parseInt(String(f.registered)) || 0 }),
      }).then(r => r.json());
      setClients(prev => [...prev, created]);
    }
    setModal(null);
  }

  async function deleteClient(id: string) {
    if (!confirm("Delete this client?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    setClients(prev => prev.filter(c => c.id !== id));
  }

  async function changeStatus(id: string, status: string) {
    const updated = await fetch(`/api/clients/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(r => r.json());
    setClients(prev => prev.map(c => c.id === id ? updated : c));
  }

  async function addNote(id: string, text: string, title?: string) {
    const note: Note = { id: uid(), type: "gen", text, ts: tsNow(), ...(title ? { title } : {}) };
    const updated = await fetch(`/api/clients/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notesToAppend: [note] }),
    }).then(r => r.json());
    setClients(prev => prev.map(c => c.id === id ? updated : c));
  }

  async function toggleNote(clientId: string, noteId: string) {
    const existing = clients.find(c => c.id === clientId);
    if (!existing) return;
    const notesReplace = existing.notes.map(n => n.id === noteId ? { ...n, done: !n.done } : n);
    const updated = await fetch(`/api/clients/${clientId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notesReplace }),
    }).then(r => r.json());
    setClients(prev => prev.map(c => c.id === clientId ? updated : c));
  }

  async function deleteNote(clientId: string, noteId: string) {
    const existing = clients.find(c => c.id === clientId);
    if (!existing) return;
    const notesReplace = existing.notes.filter(n => n.id !== noteId);
    const updated = await fetch(`/api/clients/${clientId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notesReplace }),
    }).then(r => r.json());
    setClients(prev => prev.map(c => c.id === clientId ? updated : c));
  }

  // ── AI actions ──
  async function handleAIAction({ type, clientId, fields, noteText, noteTitle, aiTagged }: {
    type: string; clientId: string; fields?: Record<string, unknown>; noteText?: string; noteTitle?: string; aiTagged?: boolean;
  }) {
    const t = tsNow();
    const existing = clients.find(c => c.id === clientId);
    if (!existing) return;
    const notesToAppend: Note[] = [];
    if (type === "update" && fields) {
      const upds: string[] = [];
      if (fields.attendees !== undefined && fields.attendees !== existing.attendees) upds.push(`Attendees updated to ${fields.attendees}/20`);
      if (fields.status    && fields.status    !== existing.status) upds.push(`Status changed to ${fields.status}`);
      if (fields.ert       && fields.ert       !== existing.ert)    upds.push(`ERT rescheduled to ${fmt(fields.ert as string)}`);
      if (fields.flag      && fields.flag      !== existing.flag)   upds.push(`Flag set: ${fields.flag}`);
      if (fields.message   && fields.message   !== existing.message)   upds.push("Outreach message updated");
      if (fields.targeting && fields.targeting !== existing.targeting) upds.push("Targeting updated");
      if (upds.length) notesToAppend.push({ id: uid(), type: "ai", text: "✦ AI: " + upds.join(", ") + ".", ts: t });
      if (noteText) notesToAppend.push({ id: uid(), type: "ai", text: noteText, ts: t });
      const updated = await fetch(`/api/clients/${clientId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, notesToAppend }),
      }).then(r => r.json());
      setClients(prev => prev.map(c => c.id === clientId ? updated : c));
    } else if (type === "note" && noteText) {
      notesToAppend.push({ id: uid(), type: aiTagged ? "ai" : "gen", text: noteText, ts: t, ...(noteTitle ? { title: noteTitle } : {}) });
      const updated = await fetch(`/api/clients/${clientId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notesToAppend }),
      }).then(r => r.json());
      setClients(prev => prev.map(c => c.id === clientId ? updated : c));
    }
  }

  // ── Attendance ──
  async function saveAtt(f: Omit<AttendanceEntry, "id">) {
    const created = await fetch("/api/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    }).then(r => r.json());
    setAttendance(prev => [...prev, created]);
    setModal(null);
  }

  async function delAtt(id: string) {
    if (id.startsWith("monday-")) return;
    await fetch(`/api/attendance/${id}`, { method: "DELETE" });
    setAttendance(prev => prev.filter(e => e.id !== id));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const mc = modal?.id ? clients.find(c => c.id === modal.id) : null;

  // Loading screen
  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#060810", gap: 22 }}>
      <div style={{ position: "relative", width: 52, height: 52 }}>
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{ animation: "hexRotate 8s linear infinite" }}>
          <path d="M26 4L46 15.5V36.5L26 48L6 36.5V15.5L26 4Z" stroke="url(#mlg1)" strokeWidth="1.2" fill="none" strokeLinejoin="round" strokeDasharray="128" style={{ animation: "dashSpin 2.4s cubic-bezier(0.4,0,0.6,1) infinite" }} />
          <defs>
            <linearGradient id="mlg1" x1="6" y1="4" x2="46" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4ba3ff" /><stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(135deg, #4ba3ff, #8b5cf6)", boxShadow: "0 0 10px rgba(75,163,255,0.6)", animation: "loadingPulse 1.4s ease-in-out infinite" }} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#4a6080", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.18em", animation: "loadingPulse 2s ease-in-out infinite" }}>LOADING</div>
    </div>
  );

  const activeTabMeta = TABS.find(t => t.id === tab)!;

  return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      background: D.bg, color: D.text,
      fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 14,
      overflow: "hidden",
    }}>

      {/* ── Top accent bar ── */}
      <div style={{ height: 2, background: "linear-gradient(90deg, #06b6d4 0%, #10b981 25%, #4ba3ff 50%, #f97316 75%, #8b5cf6 100%)", flexShrink: 0 }} />

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 14px", height: 50,
        paddingTop: `calc(0px + env(safe-area-inset-top))`,
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : D.border}`,
        background: isDark ? "rgba(6,8,16,0.92)" : D.bg2,
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        flexShrink: 0, zIndex: 20,
      }}>
        {/* Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: isDark
              ? "linear-gradient(135deg, rgba(75,163,255,0.14) 0%, rgba(139,92,246,0.14) 100%)"
              : "linear-gradient(135deg, rgba(75,163,255,0.1) 0%, rgba(139,92,246,0.1) 100%)",
            border: `1px solid ${isDark ? "rgba(75,163,255,0.22)" : "rgba(75,163,255,0.28)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="url(#mG)" strokeWidth="1.4" strokeLinejoin="round" />
              <defs>
                <linearGradient id="mG" x1="2.5" y1="1.5" x2="13.5" y2="14.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4ba3ff" /><stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>QCL</div>
            {user && <div style={{ fontSize: 10, color: D.muted, lineHeight: 1 }}>{user.name}</div>}
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Theme toggle */}
          <button onClick={toggle} style={{
            width: 30, height: 30, borderRadius: 7,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : D.border}`,
            background: isDark ? "rgba(255,255,255,0.04)" : D.bg3,
            color: D.muted, cursor: "pointer", fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{isDark ? "☀" : "◑"}</button>

          {/* Settings */}
          <button onClick={() => setShowSettings(true)} style={{
            width: 30, height: 30, borderRadius: 7,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : D.border}`,
            background: isDark ? "rgba(255,255,255,0.04)" : D.bg3,
            color: D.muted, cursor: "pointer", fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>⚙</button>

          {/* Add client */}
          <B primary sm onClick={() => setModal({ type: "add" })}>+ Client</B>

          {/* Desktop link */}
          <a href="/" style={{
            fontSize: 11, color: D.blue, textDecoration: "none", fontWeight: 600,
            padding: "5px 8px", borderRadius: 7,
            border: `1px solid ${isDark ? "rgba(75,163,255,0.2)" : "rgba(75,163,255,0.3)"}`,
            background: "rgba(75,163,255,0.06)",
            whiteSpace: "nowrap",
          }}>Desktop</a>
        </div>
      </div>

      {/* ── Tab title strip ── */}
      <div style={{
        padding: "8px 14px 6px",
        background: isDark ? "rgba(6,8,16,0.78)" : D.bg,
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : D.border}`,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: activeTabMeta.color, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{activeTabMeta.icon}</span>
          <span>{activeTabMeta.label}</span>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div key={tab} className="qcl-tab-content" style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "16px 14px 8px",
        position: "relative", zIndex: 1,
      }}>
        {/* Horizontal scroll wrapper for wide table views */}
        <div style={{ overflowX: "auto", minWidth: 0 }}>
          {tab === "overview" && (
            <Overview
              clients={clients}
              rtData={rtData}
              setModal={setModal as (m: { type: string; id: string }) => void}
              onAddNote={addNote}
              compact
            />
          )}
          {tab === "clients" && (
            <Clients
              clients={clients}
              setModal={setModal as (m: { type: string; id: string }) => void}
              onDelete={deleteClient}
              onStatusChange={changeStatus}
              rtData={rtData}
              onRefreshRt={loadRoundtable}
              rtLoading={rtLoading}
            />
          )}
          {tab === "roundtable" && (
            <RoundtableTab
              clients={clients}
              data={rtData}
              loading={rtLoading}
              error={rtError}
              onLoad={loadRoundtable}
            />
          )}
          {tab === "activity" && (DEMO
            ? <ActivityTab />
            : <MondayActivity clients={clients} data={actData} loading={actLoading} error={actError} onLoad={loadActivity} />
          )}
          {tab === "vas" && (
            <VAsTab
              clients={clients}
              attendance={attendance}
              mondayAtt={mondayAtt}
              mondayAttLoading={mondayAttLoading}
              onRefreshMondayAtt={loadMondayAtt}
              setModal={setModal as (m: { type: string }) => void}
              onDelAtt={delAtt}
            />
          )}
        </div>
      </div>

      {/* ── Bottom tab bar ── */}
      <div style={{
        display: "flex",
        background: isDark ? "rgba(6,8,16,0.95)" : D.bg2,
        borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : D.border}`,
        paddingBottom: "env(safe-area-inset-bottom)",
        flexShrink: 0, zIndex: 20,
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: "10px 0 9px", border: "none", cursor: "pointer",
                background: "transparent",
                borderTop: `2px solid ${active ? t.color : "transparent"}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                transition: "border-color 0.15s",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: active ? t.color : D.muted,
                transition: "color 0.15s",
              }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── QuickBar (AI) ── */}
      {!DEMO && (
        <QuickBar
          clients={clients}
          onAction={handleAIAction}
          setModal={setModal}
          setTab={(t: string) => setTab(t as Tab)}
        />
      )}

      {/* ── Settings modal ── */}
      {showSettings && (
        <UserSettingsModal
          userName={user?.name || ""}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── Client modals ── */}
      <Modal open={modal?.type === "add"} onClose={() => setModal(null)} title="Add client">
        <ClientForm onSave={f => saveClient(f as unknown as Record<string, unknown>)} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal?.type === "edit" && !!mc} onClose={() => setModal(null)} title="Edit client">
        {mc && <ClientForm init={mc} onSave={f => saveClient(f as unknown as Record<string, unknown>, modal!.id)} onClose={() => setModal(null)} />}
      </Modal>
      <Modal open={modal?.type === "view" && !!mc} onClose={() => setModal(null)} title={mc?.name || ""} wide>
        {mc && <Detail c={mc} onClose={() => setModal(null)} onEdit={id => setModal({ type: "edit", id })} onNote={addNote} onToggleNote={toggleNote} onDeleteNote={deleteNote} />}
      </Modal>
      <Modal open={modal?.type === "att"} onClose={() => setModal(null)} title="Log attendance entry">
        <AttForm onSave={saveAtt} onClose={() => setModal(null)} />
      </Modal>

      {/* Logout floating button */}
      <div style={{
        position: "fixed", bottom: "calc(70px + env(safe-area-inset-bottom))", right: 16,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
        zIndex: 15, pointerEvents: "none",
      }}>
        <button
          onClick={logout}
          style={{
            pointerEvents: "auto",
            padding: "7px 12px", borderRadius: 20,
            background: isDark ? "rgba(6,8,16,0.85)" : D.bg2,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : D.border}`,
            color: D.muted, fontSize: 11, fontWeight: 600, cursor: "pointer",
            backdropFilter: "blur(12px)", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span style={{ fontSize: 12 }}>⏻</span> Sign out
        </button>
      </div>
    </div>
  );
}
