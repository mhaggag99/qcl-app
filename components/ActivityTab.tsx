"use client";
import React, { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import type { ActivityLog } from "@/types";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const date = new Date(`${y}-${m}-${day}T00:00:00`);
  const dayName = date.toLocaleDateString("en-GB", { weekday: "short" });
  return `${dayName} ${parseInt(day)} ${months[parseInt(m) - 1]}`;
}

function sum(logs: ActivityLog[], field: keyof ActivityLog) {
  return logs.reduce((acc, l) => acc + ((l[field] as number) || 0), 0);
}

const COLS = ["Date", "Conn. Req", "InMails", "LI Invites", "Interested", "Registered"];

export default function ActivityTab() {
  const { D } = useTheme();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDays, setFilterDays] = useState("30");

  useEffect(() => {
    fetch("/api/activity").then((r) => r.json()).then((d) => { setLogs(d); setLoading(false); });
  }, []);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - parseInt(filterDays));
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const filtered = logs.filter((l) => l.date >= cutoffStr);

  // Group: VA → client → days[]
  const byVa: Record<string, Record<string, ActivityLog[]>> = {};
  for (const l of filtered) {
    if (!byVa[l.va]) byVa[l.va] = {};
    if (!byVa[l.va][l.clientId]) byVa[l.va][l.clientId] = [];
    byVa[l.va][l.clientId].push(l);
  }
  const vaNames = Object.keys(byVa).sort();

  const th: React.CSSProperties = {
    fontSize: 10, color: D.muted, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.05em", padding: "7px 14px", textAlign: "center",
    borderBottom: `1px solid ${D.border}`, background: D.bg3, whiteSpace: "nowrap",
  };
  const tdBase: React.CSSProperties = {
    padding: "8px 14px", borderBottom: `1px solid ${D.border}`,
    verticalAlign: "middle", textAlign: "center", fontSize: 13,
  };
  const val = (n: number, color: string) => (
    <span style={{ color: n > 0 ? color : D.hint, fontWeight: n > 0 ? 600 : 400 }}>
      {n > 0 ? n : "—"}
    </span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: D.text }}>Client Activity</div>
          <div style={{ fontSize: 12, color: D.muted, marginTop: 2 }}>Daily outreach per VA — day by day breakdown</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={filterDays} onChange={(e) => setFilterDays(e.target.value)} style={{
            padding: "6px 10px", borderRadius: 7, fontSize: 12, border: `1px solid ${D.border}`,
            background: D.bg3, color: D.text, fontFamily: "inherit", cursor: "pointer",
          }}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="9999">All time</option>
          </select>
          <a href="/va-report" target="_blank" rel="noreferrer" style={{
            fontSize: 12, fontWeight: 600, color: D.blue,
            background: `${D.blue}18`, border: `1px solid ${D.blue}30`,
            borderRadius: 7, padding: "6px 14px", textDecoration: "none", whiteSpace: "nowrap",
          }}>Open VA form ↗</a>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: D.muted, fontSize: 13 }}>Loading...</div>
      ) : vaNames.length === 0 ? (
        <div style={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 12, padding: "52px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
          <div style={{ color: D.muted, fontSize: 14 }}>No activity submitted yet.</div>
          <div style={{ color: D.hint, fontSize: 12, marginTop: 6 }}>VAs submit their daily numbers at <strong style={{ color: D.blue }}>/va-report</strong></div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {vaNames.map((vaName) => {
            const clientMap = byVa[vaName];
            const clientIds = Object.keys(clientMap);

            return (
              <div key={vaName} style={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>

                {/* VA header */}
                <div style={{
                  padding: "11px 16px", background: D.bg3,
                  borderBottom: `1px solid ${D.border}`,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: `${D.purple}22`, border: `1px solid ${D.purple}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: D.purple,
                  }}>{vaName[0]}</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: D.text }}>{vaName}</span>
                  <span style={{ fontSize: 11, color: D.muted }}>
                    {clientIds.length} client{clientIds.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {COLS.map((h, i) => (
                        <th key={h} style={{ ...th, textAlign: i === 0 ? "left" : "center" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientIds.map((cid, ci) => {
                      const rows = [...clientMap[cid]].sort((a, b) => b.date.localeCompare(a.date));
                      const clientName = rows[0].clientName;
                      const isLast = ci === clientIds.length - 1;

                      return (
                        <React.Fragment key={cid}>
                          {/* Client name separator */}
                          <tr>
                            <td colSpan={6} style={{
                              padding: "7px 14px", fontSize: 11, fontWeight: 700,
                              color: D.blue, background: `${D.blue}0a`,
                              borderTop: ci > 0 ? `2px solid ${D.border}` : undefined,
                              borderBottom: `1px solid ${D.border}`,
                              textTransform: "uppercase", letterSpacing: "0.06em",
                            }}>
                              {clientName}
                            </td>
                          </tr>

                          {/* One row per day */}
                          {rows.map((log) => (
                            <tr key={log.id} style={{ background: D.bg2 }}>
                              <td style={{ ...tdBase, textAlign: "left", color: D.muted, fontFamily: "monospace", fontSize: 12 }}>
                                {fmtDate(log.date)}
                              </td>
                              <td style={tdBase}>{val(log.connReqSent, D.blue)}</td>
                              <td style={tdBase}>{val(log.inmailsSent, D.purple)}</td>
                              <td style={tdBase}>{val(log.liEventInvites, D.green)}</td>
                              <td style={tdBase}>{val(log.interested, D.amber)}</td>
                              <td style={tdBase}>{val(log.registeredErt, D.green)}</td>
                            </tr>
                          ))}

                          {/* Client total row */}
                          {rows.length > 1 && (
                            <tr style={{ background: D.bg3 }}>
                              <td style={{ ...tdBase, textAlign: "left", fontSize: 10, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {clientName} Total
                              </td>
                              <td style={{ ...tdBase, color: D.blue, fontWeight: 700 }}>{sum(rows, "connReqSent") || "—"}</td>
                              <td style={{ ...tdBase, color: D.purple, fontWeight: 700 }}>{sum(rows, "inmailsSent") || "—"}</td>
                              <td style={{ ...tdBase, color: D.green, fontWeight: 700 }}>{sum(rows, "liEventInvites") || "—"}</td>
                              <td style={{ ...tdBase, color: D.amber, fontWeight: 700 }}>{sum(rows, "interested") || "—"}</td>
                              <td style={{ ...tdBase, color: D.green, fontWeight: 700 }}>{sum(rows, "registeredErt") || "—"}</td>
                            </tr>
                          )}

                          {/* Spacer after last client */}
                          {isLast && (
                            <tr style={{ background: `${D.purple}0a` }}>
                              <td style={{ ...tdBase, textAlign: "left", fontSize: 10, fontWeight: 700, color: D.purple, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {vaName} — Grand Total
                              </td>
                              <td style={{ ...tdBase, color: D.blue, fontWeight: 700 }}>{sum(filtered.filter(l => l.va === vaName), "connReqSent") || "—"}</td>
                              <td style={{ ...tdBase, color: D.purple, fontWeight: 700 }}>{sum(filtered.filter(l => l.va === vaName), "inmailsSent") || "—"}</td>
                              <td style={{ ...tdBase, color: D.green, fontWeight: 700 }}>{sum(filtered.filter(l => l.va === vaName), "liEventInvites") || "—"}</td>
                              <td style={{ ...tdBase, color: D.amber, fontWeight: 700 }}>{sum(filtered.filter(l => l.va === vaName), "interested") || "—"}</td>
                              <td style={{ ...tdBase, color: D.green, fontWeight: 700 }}>{sum(filtered.filter(l => l.va === vaName), "registeredErt") || "—"}</td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
