"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import type { Client } from "@/types";
import type { ActivityRow } from "@/types";

const ACCENT_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#84CC16"];

function MondayLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size * 2.2} height={size} viewBox="0 0 44 20" fill="none">
      <ellipse cx="6" cy="10" rx="6" ry="6" fill="#FF3D57" />
      <ellipse cx="22" cy="10" rx="6" ry="6" fill="#FF7D4F" />
      <ellipse cx="38" cy="10" rx="6" ry="6" fill="#FFCB00" />
    </svg>
  );
}

function cleanMonday(name: string): string {
  return name.replace(/\s*\(copy\)\s*/gi, "").replace(/\s*\bcopy\b\s*$/gi, "").trim();
}

function nameMatch(mondayName: string, dashboardClients: Client[]): string | null {
  const mn = cleanMonday(mondayName).toLowerCase();
  const match = dashboardClients.find((c) => {
    const cn = c.name.toLowerCase().trim();
    if (cn === mn) return true;
    const parts = cn.split(" ").filter((p) => p.length > 2);
    return parts.length > 0 && parts.every((p) => mn.includes(p));
  });
  return match ? match.name : null;
}

function Num({ val, color }: { val: number; color: string }) {
  const { D } = useTheme();
  return (
    <span style={{ fontWeight: 700, fontSize: 14, color: val > 0 ? color : D.hint }}>
      {val > 0 ? val : "—"}
    </span>
  );
}

interface ClientGroup {
  clientName: string;
  va: string;
  ertDate: string;
  rows: ActivityRow[];
  totals: { connReq: number; liEvent: number; inmail: number; connections: number };
  accent: string;
}

export default function MondayActivity({ clients, data, loading, error, onLoad }: {
  clients: Client[];
  data: { boardName: string; rows: ActivityRow[] } | null;
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

  // Build per-client groups from rows
  const clientMap = new Map<string, ClientGroup>();
  let accentIdx = 0;
  for (const row of data?.rows || []) {
    const key = nameMatch(row.clientName, clients);
    if (!key) continue;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        clientName: key,
        va: row.va,
        ertDate: row.ertDate,
        rows: [],
        totals: { connReq: 0, liEvent: 0, inmail: 0, connections: 0 },
        accent: ACCENT_COLORS[accentIdx++ % ACCENT_COLORS.length],
      });
    }
    const g = clientMap.get(key)!;
    if (!g.va && row.va) g.va = row.va;
    if (!g.ertDate && row.ertDate) g.ertDate = row.ertDate;
    g.rows.push(row);
    g.totals.connReq    += row.connReqSent;
    g.totals.liEvent    += row.liEventInvites;
    g.totals.inmail     += row.inmailSent;
    g.totals.connections += row.connectionsMade;
  }

  const groups = Array.from(clientMap.values())
    .sort((a, b) => a.clientName.localeCompare(b.clientName))
    .filter((g) => !search || g.clientName.toLowerCase().includes(search.toLowerCase()));

  const th: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase",
    letterSpacing: "0.06em", padding: "9px 14px", textAlign: "left",
    borderBottom: `1px solid #FF7D4F30`, background: "#FF7D4F08", whiteSpace: "nowrap",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MondayLogo size={14} />
          <span style={{ fontSize: 16, fontWeight: 700, color: D.text, letterSpacing: "-0.01em" }}>
            {data?.boardName || "Client Activity"}
          </span>
          {data && (
            <span style={{ fontSize: 12, color: D.hint }}>{groups.length} clients</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client…"
            style={{ height: 32, padding: "0 10px", fontSize: 12, borderRadius: 8, border: `1px solid ${D.border}`, background: D.bg3, color: D.text, outline: "none", fontFamily: "inherit", width: 160 }}
          />
          <button onClick={onLoad} disabled={loading} style={{ height: 32, padding: "0 12px", borderRadius: 8, border: `1px solid #FF7D4F40`, background: "#FF7D4F12", color: "#FF7D4F", fontSize: 12, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {error && <div style={{ textAlign: "center", padding: "40px 16px", color: D.muted, fontSize: 13 }}>{error}</div>}
      {loading && !data && <div style={{ textAlign: "center", padding: "40px 16px", color: D.hint, fontSize: 13 }}>Loading from Monday…</div>}

      {data && (
        <div style={{ border: `1px solid #FF7D4F30`, borderRadius: 12, overflow: "hidden" }}>
          {/* Column headers — same grid as data rows */}
          <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 90px 110px 90px 90px 90px 110px" }}>
            <div style={th} />
            <div style={th}>Client</div>
            <div style={th}>VA</div>
            <div style={th}>ERT Date</div>
            <div style={{ ...th, textAlign: "center" }}>Conn. Req</div>
            <div style={{ ...th, textAlign: "center" }}>LI Invites</div>
            <div style={{ ...th, textAlign: "center" }}>Inmail</div>
            <div style={{ ...th, textAlign: "center" }}>Connections</div>
          </div>

          {groups.length === 0
            ? <div style={{ padding: "32px", textAlign: "center", color: D.hint, fontSize: 13 }}>{search ? `No clients matching "${search}"` : "No data"}</div>
            : groups.map((g) => {
              const isOpen = expanded.has(g.clientName);
              const sortedRows = [...g.rows].sort((a, b) => (b.activityDate || b.date).localeCompare(a.activityDate || a.date));
              return (
                <div key={g.clientName} style={{ borderBottom: `1px solid ${D.border}` }}>
                  {/* Summary / collapsed row */}
                  <div
                    onClick={() => toggleExpand(g.clientName)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr 90px 110px 90px 90px 90px 110px",
                      alignItems: "center",
                      padding: "0",
                      background: isOpen ? `${g.accent}10` : D.bg2,
                      borderLeft: `3px solid ${g.accent}`,
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    className="qcl-row"
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 0", color: g.accent, fontSize: 11, fontWeight: 700 }}>
                      {isOpen ? "▾" : "▸"}
                    </div>
                    <div style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: D.text }}>{g.clientName}</div>
                    <div style={{ padding: "12px 14px", fontSize: 12, color: D.muted }}>{g.va || "—"}</div>
                    <div style={{ padding: "12px 14px", fontSize: 12, color: g.ertDate ? D.text : D.hint }}>{g.ertDate || "—"}</div>
                    <div style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: g.totals.connReq > 0 ? D.blue : D.hint }}>{g.totals.connReq || "—"}</span>
                    </div>
                    <div style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: g.totals.liEvent > 0 ? D.purple : D.hint }}>{g.totals.liEvent || "—"}</span>
                    </div>
                    <div style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: g.totals.inmail > 0 ? D.amber : D.hint }}>{g.totals.inmail || "—"}</span>
                    </div>
                    <div style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: g.totals.connections > 0 ? D.green : D.hint }}>{g.totals.connections || "—"}</span>
                    </div>
                  </div>

                  {/* Expanded daily rows */}
                  {isOpen && (
                    <div style={{ background: D.bg3, borderTop: `1px solid ${g.accent}20` }}>
                      {/* Sub-header */}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr 90px 90px 90px 110px",
                        padding: "6px 0",
                        borderBottom: `1px solid ${D.border}`,
                        background: `${g.accent}08`,
                      }}>
                        <div />
                        <div style={{ padding: "0 14px 0 42px", fontSize: 10, fontWeight: 700, color: g.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Outreach Date</div>
                        <div style={{ padding: "0 14px", fontSize: 10, fontWeight: 700, color: D.hint, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Conn. Req</div>
                        <div style={{ padding: "0 14px", fontSize: 10, fontWeight: 700, color: D.hint, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>LI Invites</div>
                        <div style={{ padding: "0 14px", fontSize: 10, fontWeight: 700, color: D.hint, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Inmail</div>
                        <div style={{ padding: "0 14px", fontSize: 10, fontWeight: 700, color: D.hint, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Connections</div>
                      </div>
                      {sortedRows.map((row, i) => (
                        <div key={i} style={{
                          display: "grid",
                          gridTemplateColumns: "28px 1fr 90px 90px 90px 110px",
                          alignItems: "center",
                          borderBottom: i < sortedRows.length - 1 ? `1px solid ${D.border}` : "none",
                          background: i % 2 === 0 ? D.bg3 : D.bg2,
                        }}>
                          <div style={{ borderLeft: `3px solid ${g.accent}40` }} />
                          <div style={{ padding: "9px 14px 9px 42px", fontSize: 12, color: D.muted }}>
                            {row.activityDate || row.date || "—"}
                          </div>
                          <div style={{ padding: "9px 14px", textAlign: "center" }}><Num val={row.connReqSent} color={D.blue} /></div>
                          <div style={{ padding: "9px 14px", textAlign: "center" }}><Num val={row.liEventInvites} color={D.purple} /></div>
                          <div style={{ padding: "9px 14px", textAlign: "center" }}><Num val={row.inmailSent} color={D.amber} /></div>
                          <div style={{ padding: "9px 14px", textAlign: "center" }}><Num val={row.connectionsMade} color={D.green} /></div>
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
