"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "@/lib/theme";
import type { CalEvent } from "@/app/api/calendar/route";

interface CalData { today: CalEvent[]; tomorrow: CalEvent[] }

interface NewEventForm {
  title: string;
  date: "today" | "tomorrow" | "custom";
  customDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function tomorrowStr() {
  const d = new Date(Date.now() + 86400000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function EventRow({ ev, isLast }: { ev: CalEvent; isLast: boolean }) {
  const { D } = useTheme();
  return (
    <div style={{
      padding: "11px 16px",
      borderBottom: isLast ? "none" : `1px solid ${D.border}`,
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <div style={{ minWidth: 62, flexShrink: 0, textAlign: "right", paddingTop: 1 }}>
        {ev.allDay
          ? <span style={{ fontSize: 10, color: D.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>All day</span>
          : (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: D.blue, fontVariantNumeric: "tabular-nums" }}>{ev.startTime}</div>
              {ev.endTime && <div style={{ fontSize: 10, color: D.muted, marginTop: 1 }}>{ev.endTime}</div>}
            </div>
          )
        }
      </div>
      <div style={{ width: 2, borderRadius: 2, background: D.blue, opacity: 0.4, alignSelf: "stretch", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: D.text, marginBottom: ev.location || ev.description ? 3 : 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {ev.title}
        </div>
        {ev.location && (
          <div style={{ fontSize: 11, color: D.muted, marginBottom: ev.description ? 2 : 0, display: "flex", alignItems: "center", gap: 4 }}>
            <span>📍</span> {ev.location}
          </div>
        )}
        {ev.description && (
          <div style={{ fontSize: 11, color: D.hint, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"] }}>
            {ev.description}
          </div>
        )}
      </div>
    </div>
  );
}

function DaySection({ label, events, accent }: { label: string; events: CalEvent[]; accent: string }) {
  const { D } = useTheme();
  return (
    <div>
      <div style={{ padding: "8px 16px", background: D.bg3, borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: `${accent}18`, border: `1px solid ${accent}35`, borderRadius: 9, padding: "1px 7px" }}>
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </div>
      {events.length === 0
        ? <div style={{ padding: "18px 16px", textAlign: "center", color: D.hint, fontSize: 12 }}>No meetings</div>
        : events.map((ev, i) => <EventRow key={ev.id + i} ev={ev} isLast={i === events.length - 1} />)
      }
    </div>
  );
}

const EMPTY_FORM: NewEventForm = {
  title: "", date: "today", customDate: "", allDay: false, startTime: "09:00", endTime: "10:00", location: "",
};

export default function CalendarPanel({ accent }: { accent?: string } = {}) {
  const { D } = useTheme();
  const [data, setData] = useState<CalData | null>(null);
  const [error, setError] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewEventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(async () => {
    setRefreshing(true);
    try {
      const d = await fetch("/api/calendar").then((r) => r.json());
      if (d.error) setError(true);
      else { setData(d); setError(false); }
    } catch { setError(true); }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetch("/api/auth/status").then((r) => r.json()).then((d) => setConnected(d.connected)).catch(() => setConnected(false));
    fetchEvents();
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("cal_connected")) {
        setConnected(true);
        window.history.replaceState({}, "", "/");
      }
      window.addEventListener("cal-refresh", fetchEvents);
      return () => window.removeEventListener("cal-refresh", fetchEvents);
    }
  }, [fetchEvents]);

  const inp: React.CSSProperties = {
    background: D.bg3, border: `1px solid ${D.border}`, borderRadius: 6,
    color: D.text, fontSize: 12, fontFamily: "inherit",
    padding: "5px 8px", outline: "none", width: "100%", boxSizing: "border-box",
  };

  async function handleDisconnect() {
    await fetch("/api/auth/revoke", { method: "POST" });
    setConnected(false);
    setShowForm(false);
  }

  async function handleSave() {
    if (!form.title.trim()) { setSaveError("Title is required"); return; }
    setSaving(true);
    setSaveError("");
    const date = form.date === "custom" ? form.customDate : form.date === "today" ? todayStr() : tomorrowStr();
    const res = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        date,
        allDay: form.allDay,
        startTime: form.allDay ? undefined : form.startTime,
        endTime: form.allDay ? undefined : form.endTime,
        location: form.location.trim() || undefined,
      }),
    }).then((r) => r.json());
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchEvents();
    } else {
      setSaveError(res.error || "Failed to create event");
    }
  }

  const btnBase: React.CSSProperties = {
    border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
    fontWeight: 600, fontSize: 11, padding: "5px 10px", transition: "opacity 0.1s",
  };

  return (
    <div style={{ background: D.bg2, border: `1px solid ${accent ? accent + "60" : D.border}`, borderRadius: 12, overflow: "hidden", boxShadow: accent ? `0 0 0 1px ${accent}15, 0 4px 20px ${accent}12` : undefined }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${accent ? accent + "25" : D.border}`, background: accent ? `linear-gradient(135deg, ${accent}22 0%, ${accent}10 100%)` : D.bg3, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>📅</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent || D.muted, textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>My Calendar</span>
        {connected && (
          <>
            <button
              onClick={fetchEvents}
              title="Refresh"
              style={{ ...btnBase, background: "none", color: refreshing ? D.hint : D.muted, padding: "4px 6px", fontSize: 13 }}
            >↻</button>
            <button
              onClick={() => { setShowForm((v) => !v); setSaveError(""); }}
              title="Add event"
              style={{ ...btnBase, background: D.blue, color: "#fff", padding: "4px 10px" }}
            >+ Add</button>
          </>
        )}
      </div>

      {/* Add event form */}
      {showForm && connected && (
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${D.border}`, background: D.bg2, display: "flex", flexDirection: "column", gap: 9 }}>
          {/* Title */}
          <input
            style={inp}
            placeholder="Event title *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
          />

          {/* Date selector */}
          <div style={{ display: "flex", gap: 5 }}>
            {(["today", "tomorrow", "custom"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setForm((f) => ({ ...f, date: opt }))}
                style={{
                  ...btnBase, fontWeight: 500, fontSize: 11,
                  background: form.date === opt ? D.bbg : D.bg3,
                  color: form.date === opt ? D.blue : D.muted,
                  border: `1px solid ${form.date === opt ? D.blue : D.border}`,
                  flex: opt === "custom" ? 1 : "none",
                }}
              >{opt === "custom" ? "Custom" : opt.charAt(0).toUpperCase() + opt.slice(1)}</button>
            ))}
          </div>
          {form.date === "custom" && (
            <input type="date" style={inp} value={form.customDate} onChange={(e) => setForm((f) => ({ ...f, customDate: e.target.value }))} />
          )}

          {/* All day toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: D.muted, cursor: "pointer" }}>
            <input type="checkbox" checked={form.allDay} onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))} style={{ accentColor: D.blue }} />
            All day
          </label>

          {/* Time pickers */}
          {!form.allDay && (
            <div style={{ display: "flex", gap: 7 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: D.hint, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Start</div>
                <input type="time" style={inp} value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: D.hint, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>End</div>
                <input type="time" style={inp} value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Location */}
          <input
            style={inp}
            placeholder="Location (optional)"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />

          {saveError && <div style={{ fontSize: 11, color: D.red }}>{saveError}</div>}

          {/* Actions */}
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setSaveError(""); }}
              style={{ ...btnBase, background: D.bg3, color: D.muted, border: `1px solid ${D.border}`, flex: 1 }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ ...btnBase, background: D.green, color: "#000", flex: 1, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save event"}
            </button>
          </div>
        </div>
      )}

      {/* Connect banner (not connected) */}
      {connected === false && (
        <div style={{ padding: "20px 16px", textAlign: "center", borderBottom: `1px solid ${D.border}` }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>🔗</div>
          <div style={{ fontSize: 12, color: D.muted, marginBottom: 12, lineHeight: 1.5 }}>
            Connect Google Calendar to sync events and create new ones from here.
          </div>
          <a href="/api/auth" style={{
            display: "inline-block", background: D.blue, color: "#fff",
            borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 600,
            textDecoration: "none", fontFamily: "inherit",
          }}>Connect Google Calendar</a>
        </div>
      )}

      {/* Events */}
      {error && !connected && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: D.red, fontSize: 12 }}>Failed to load calendar</div>
      )}

      {!data && !error && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: D.hint, fontSize: 12 }}>Loading…</div>
      )}

      {data && (
        <>
          <DaySection label="Today" events={data.today} accent={D.green} />
          <DaySection label="Tomorrow" events={data.tomorrow} accent={D.blue} />
        </>
      )}

      {/* Disconnect link */}
      {connected && (
        <div style={{ padding: "8px 16px", borderTop: `1px solid ${D.border}`, textAlign: "right" }}>
          <button onClick={handleDisconnect} style={{ background: "none", border: "none", fontSize: 11, color: D.hint, cursor: "pointer", fontFamily: "inherit" }}>
            Disconnect calendar
          </button>
        </div>
      )}
    </div>
  );
}
