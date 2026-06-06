"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import type { Client, RoundtableEvent } from "@/types";

const ACCENT_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#84CC16"];

function RoundtableIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="#3B82F6" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="3" fill="#3B82F6" opacity="0.5" />
      <circle cx="10" cy="3" r="1.5" fill="#3B82F6" />
      <circle cx="10" cy="17" r="1.5" fill="#3B82F6" />
      <circle cx="3" cy="10" r="1.5" fill="#3B82F6" />
      <circle cx="17" cy="10" r="1.5" fill="#3B82F6" />
    </svg>
  );
}

function cleanMonday(name: string): string {
  return name.replace(/\s*\(copy\)\s*/gi, "").replace(/\s*\bcopy\b\s*$/gi, "").trim();
}

function Num({ val, color }: { val: number | null; color: string }) {
  const { D } = useTheme();
  if (val === null) return <span style={{ color: D.hint }}>—</span>;
  return <span style={{ fontWeight: 700, fontSize: 14, color: val > 0 ? color : D.hint }}>{val > 0 ? val : "—"}</span>;
}

interface ClientGroup {
  clientName: string;
  events: RoundtableEvent[];
  accent: string;
  totals: { attendees: number; registered: number; calConfirmed: number };
  latestDate: string;
}

export default function RoundtableTab({ clients, data, loading, error, onLoad }: {
  clients: Client[];
  data: { boardName: string; events: RoundtableEvent[] } | null;
  loading: boolean;
  error: string;
  onLoad: () => void;
}) {
  const { D } = useTheme();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { if (!data) onLoad(); }, []);

  function toggleExpand(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function resolveClientName(mondayName: string): string | null {
    const mn = cleanMonday(mondayName).toLowerCase();
    const match = clients.find((c) => {
      const cn = c.name.toLowerCase().trim();
      if (cn === mn) return true;
      const parts = cn.split(" ").filter((p) => p.length > 2);
      return parts.length > 0 && parts.every((p) => mn.includes(p));
    });
    return match ? match.name : null;
  }

  const clientMap = new Map<string, ClientGroup>();
  let accentIdx = 0;
  for (const ev of data?.events || []) {
    const key = resolveClientName(ev.clientName);
    if (!key) continue;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        clientName: key,
        events: [],
        accent: ACCENT_COLORS[accentIdx++ % ACCENT_COLORS.length],
        totals: { attendees: 0, registered: 0, calConfirmed: 0 },
        latestDate: "",
      });
    }
    const g = clientMap.get(key)!;
    g.events.push(ev);
    if (ev.attendees) g.totals.attendees += ev.attendees;
    if (ev.registered) g.totals.registered += ev.registered;
    if (ev.calendarConfirmed) g.totals.calConfirmed += ev.calendarConfirmed;
    if (!g.latestDate || (ev.date && ev.date > g.latestDate)) g.latestDate = ev.date;
  }

  const groups = Array.from(clientMap.values())
    .map((g) => ({ ...g, events: [...g.events].sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName))
    .filter((g) => !search || g.clientName.toLowerCase().includes(search.toLowerCase()));

  const th: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase",
    letterSpacing: "0.06em", padding: "9px 14px", textAlign: "left",
    borderBottom: `1px solid ${D.blue}30`, background: `${D.blue}08`, whiteSpace: "nowrap",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <RoundtableIcon size={16} />
          <span style={{ fontSize: 16, fontWeight: 700, color: D.text, letterSpacing: "-0.01em" }}>
            {data?.boardName || "Client Roundtable Status"}
          </span>
          {data && (
            <span style={{ fontSize: 12, color: D.hint }}>
              {groups.length} clients · {groups.reduce((s, g) => s + g.events.length, 0)} roundtables
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client…"
            style={{ height: 32, padding: "0 10px", fontSize: 12, borderRadius: 8, border: `1px solid ${D.border}`, background: D.bg3, color: D.text, outline: "none", fontFamily: "inherit", width: 160 }}
          />
          <button onClick={onLoad} disabled={loading} style={{ height: 32, padding: "0 12px", borderRadius: 8, border: `1px solid ${D.blue}40`, background: `${D.blue}12`, color: D.blue, fontSize: 12, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {error && <div style={{ textAlign: "center", padding: "40px 16px", color: D.muted, fontSize: 13 }}>{error}</div>}
      {loading && !data && <div style={{ textAlign: "center", padding: "40px 16px", color: D.hint, fontSize: 13 }}>Loading from Monday…</div>}

      {data && (
        <div style={{ border: `1px solid ${D.blue}30`, borderRadius: 12, overflow: "hidden" }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 80px 110px 90px 90px 130px" }}>
            <div style={th} />
            <div style={th}>Client</div>
            <div style={{ ...th, textAlign: "center" }}># ERTs</div>
            <div style={th}>Latest Date</div>
            <div style={{ ...th, textAlign: "center" }}>Attendees</div>
            <div style={{ ...th, textAlign: "center" }}>Registered</div>
            <div style={{ ...th, textAlign: "center" }}>Cal. Confirmed</div>
          </div>

          {groups.length === 0
            ? <div style={{ padding: "32px", textAlign: "center", color: D.hint, fontSize: 13 }}>{search ? `No clients matching "${search}"` : "No data"}</div>
            : groups.map((g) => {
              const isOpen = expanded.has(g.clientName);
              return (
                <div key={g.clientName} style={{ borderBottom: `1px solid ${D.border}` }}>
                  {/* Summary row */}
                  <div
                    onClick={() => toggleExpand(g.clientName)}
                    style={{
                      display: "grid", gridTemplateColumns: "28px 1fr 80px 110px 90px 90px 130px",
                      alignItems: "center",
                      background: isOpen ? `${g.accent}10` : D.bg2,
                      borderLeft: `3px solid ${g.accent}`,
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    className="qcl-row"
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 0", color: g.accent, fontSize: 11, fontWeight: 700 }}>
                      {isOpen ? "▾" : "▸"}
                    </div>
                    <div style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: D.text }}>{g.clientName}</div>
                    <div style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: `${g.accent}18`, border: `1px solid ${g.accent}40`, color: g.accent, fontWeight: 700, fontSize: 12 }}>
                        {g.events.length}
                      </span>
                    </div>
                    <div style={{ padding: "12px 14px", fontSize: 12, color: g.latestDate ? D.text : D.hint }}>{g.latestDate || "—"}</div>
                    <div style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: g.totals.attendees > 0 ? D.blue : D.hint }}>{g.totals.attendees || "—"}</span>
                    </div>
                    <div style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: g.totals.registered > 0 ? D.green : D.hint }}>{g.totals.registered || "—"}</span>
                    </div>
                    <div style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: g.totals.calConfirmed > 0 ? D.purple : D.hint }}>{g.totals.calConfirmed || "—"}</span>
                    </div>
                  </div>

                  {/* Expanded individual ERT rows */}
                  {isOpen && (
                    <div style={{ background: D.bg3, borderTop: `1px solid ${g.accent}20` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 110px 90px 90px 130px", padding: "6px 0", borderBottom: `1px solid ${D.border}`, background: `${g.accent}08` }}>
                        <div />
                        <div style={{ padding: "0 14px 0 42px", fontSize: 10, fontWeight: 700, color: g.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</div>
                        <div style={{ padding: "0 14px", fontSize: 10, fontWeight: 700, color: D.hint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Time</div>
                        <div style={{ padding: "0 14px", fontSize: 10, fontWeight: 700, color: D.hint, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Attendees</div>
                        <div style={{ padding: "0 14px", fontSize: 10, fontWeight: 700, color: D.hint, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Registered</div>
                        <div style={{ padding: "0 14px", fontSize: 10, fontWeight: 700, color: D.hint, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Cal. Confirmed</div>
                      </div>
                      {g.events.map((ev, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr 110px 90px 90px 130px", alignItems: "center", borderBottom: i < g.events.length - 1 ? `1px solid ${D.border}` : "none", background: i % 2 === 0 ? D.bg3 : D.bg2 }}>
                          <div style={{ borderLeft: `3px solid ${g.accent}40` }} />
                          <div style={{ padding: "9px 14px 9px 42px", fontSize: 12, color: D.muted }}>{ev.date || "—"}</div>
                          <div style={{ padding: "9px 14px", fontSize: 12, color: D.muted }}>{ev.rtTime || "—"}</div>
                          <div style={{ padding: "9px 14px", textAlign: "center" }}><Num val={ev.attendees} color={D.blue} /></div>
                          <div style={{ padding: "9px 14px", textAlign: "center" }}><Num val={ev.registered} color={D.green} /></div>
                          <div style={{ padding: "9px 14px", textAlign: "center" }}><Num val={ev.calendarConfirmed} color={D.purple} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  );
}
