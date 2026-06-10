"use client";
import React, { useState, useMemo } from "react";
import type { Client, AttendanceEntry } from "@/types";
import type { VAAttendanceEntry } from "@/lib/monday";
import { VAS } from "@/lib/constants";
import { useTheme } from "@/lib/theme";
import { fmt } from "@/lib/utils";
import { B, IB, VaChip } from "./ui";

function mondayToEntry(m: VAAttendanceEntry): AttendanceEntry {
  let notes = m.type;
  if (m.reason) notes += ` — ${m.reason}`;
  if (m.returnDate && m.returnDate !== m.date) notes += ` (returns ${fmt(m.returnDate)})`;
  return {
    id: `monday-${m.id}`, va: m.va, date: m.date,
    late: m.late, absent: m.absent, ooz: false,
    notes, shortNotice: m.shortNotice, submittedPHT: m.submittedPHT,
  };
}

export default function VAsTab({ clients, attendance, mondayAtt, mondayAttLoading, onRefreshMondayAtt, setModal, onDelAtt }: {
  clients: Client[];
  attendance: AttendanceEntry[];
  mondayAtt: VAAttendanceEntry[];
  mondayAttLoading: boolean;
  onRefreshMondayAtt: () => void;
  setModal: (m: { type: string }) => void;
  onDelAtt: (id: string) => void;
}) {
  const { D } = useTheme();
  const [filterVa, setFilterVa] = useState<string>("All");
  const [monthOffset, setMonthOffset] = useState(0);

  const n = new Date();
  const viewYear = new Date(n.getFullYear(), n.getMonth() + monthOffset, 1).getFullYear();
  const viewMonth = new Date(n.getFullYear(), n.getMonth() + monthOffset, 1).getMonth();
  const m1 = new Date(viewYear, viewMonth, 1).toISOString().slice(0, 10);
  const m2 = new Date(viewYear, viewMonth + 1, 0).toISOString().slice(0, 10);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  // Merge local (OOZ-focused) + Monday (late/absent) entries, deduplicate by id
  // Only include local entries for our VAs (filter out other teams' entries)
  const vasSet = new Set<string>(VAS);
  const mondayEntries = useMemo(() => mondayAtt.map(mondayToEntry), [mondayAtt]);
  const allAttendance = useMemo(() => {
    const seen = new Set<string>();
    return [...mondayEntries, ...attendance.filter((e) => vasSet.has(e.va))]
      .filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
  }, [mondayEntries, attendance]);

  const monthEntries = allAttendance.filter((e) => e.date >= m1 && e.date <= m2);

  const totalStrikes = VAS.reduce((sum, va) => {
    const e = monthEntries.filter((x) => x.va === va);
    const lates = e.filter((x) => x.late).length;
    // Only count short-notice Monday absences + all local absences (not verified leaves)
    const absents = e.filter((x) => x.absent && (x.shortNotice !== false)).length;
    return sum + Math.floor(lates / 3) + Math.floor(absents / 2);
  }, 0);

  const filteredLog = monthEntries
    .filter((e) => filterVa === "All" || e.va === filterVa)
    .sort((a, b) => b.date.localeCompare(a.date));

  const th: React.CSSProperties = {
    fontSize: 11, color: D.muted, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.05em", padding: "8px 14px", textAlign: "left",
    borderBottom: `1px solid ${D.border}`, background: D.bg3, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "10px 14px", borderBottom: `1px solid ${D.border}`,
    verticalAlign: "middle", fontSize: 13,
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: D.text, letterSpacing: "-0.01em" }}>VA Tracker</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => setMonthOffset((o) => o - 1)} style={{
              width: 24, height: 24, borderRadius: 6, border: `1px solid ${D.border}`,
              background: D.bg3, color: D.muted, cursor: "pointer", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>‹</button>
            <span style={{ fontSize: 12, color: monthOffset === 0 ? D.blue : D.hint, fontWeight: monthOffset === 0 ? 600 : 400, minWidth: 110, textAlign: "center" }}>
              {monthLabel}
            </span>
            <button
              onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
              disabled={monthOffset === 0}
              style={{
                width: 24, height: 24, borderRadius: 6, border: `1px solid ${D.border}`,
                background: D.bg3, color: monthOffset === 0 ? D.hint : D.muted,
                cursor: monthOffset === 0 ? "default" : "pointer", fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: monthOffset === 0 ? 0.3 : 1,
              }}>›</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: D.muted }}>
            <span style={{ fontWeight: 700, color: totalStrikes >= 3 ? D.red : totalStrikes > 0 ? D.amber : D.green }}>
              {totalStrikes}
            </span>
            {" "}team strike{totalStrikes !== 1 ? "s" : ""} this month
          </div>
          <button
            onClick={onRefreshMondayAtt}
            disabled={mondayAttLoading}
            title="Sync attendance from Monday"
            style={{
              background: "none", border: `1px solid ${D.border}`, borderRadius: 6,
              padding: "4px 9px", cursor: mondayAttLoading ? "default" : "pointer",
              color: mondayAttLoading ? D.hint : D.muted, fontSize: 11, fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <span style={{ display: "inline-block", animation: mondayAttLoading ? "spin 1s linear infinite" : "none" }}>↻</span>
            {mondayAttLoading ? "Syncing…" : "Sync"}
          </button>
          <B sm onClick={() => setModal({ type: "att" })}>+ Log OOZ</B>
        </div>
      </div>

      {/* VA cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 24 }}>
        {VAS.map((va) => {
          const entries = monthEntries.filter((e) => e.va === va);
          const lates = entries.filter((e) => e.late).length;
          const absents = entries.filter((e) => e.absent && (e.shortNotice !== false)).length;
          const verifiedLeaves = entries.filter((e) => e.absent && e.shortNotice === false).length;
          const oozs = entries.filter((e) => e.ooz).length;
          const strikes = Math.floor(lates / 3) + Math.floor(absents / 2);
          const attendRate = entries.length > 0
            ? Math.round(((entries.length - absents) / entries.length) * 100)
            : 100;

          const sc = strikes === 0
            ? { bg: `${D.green}15`, c: D.green, border: `${D.green}30` }
            : strikes < 3
            ? { bg: `${D.amber}15`, c: D.amber, border: `${D.amber}30` }
            : { bg: `${D.red}15`, c: D.red, border: `${D.red}30` };

          const stats: [number, string, string | null][] = [
            [clients.filter((c) => c.va === va).length, "Clients", null],
            [lates, "Late", lates > 0 ? D.amber : null],
            [absents, "Absent", absents > 0 ? D.red : null],
            [verifiedLeaves, "Verified", verifiedLeaves > 0 ? D.green : null],
            [oozs, "OoZ", oozs > 0 ? D.amber : null],
          ];

          return (
            <div key={va} className="qcl-card" style={{
              background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 12, padding: "16px 18px",
            }}>
              {/* Card header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <VaChip va={va} />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {entries.length > 0 && (
                    <span style={{ fontSize: 11, color: D.hint }}>
                      <span style={{ fontWeight: 600, color: attendRate >= 95 ? D.green : attendRate >= 80 ? D.amber : D.red }}>
                        {attendRate}%
                      </span>
                      {" "}attendance
                    </span>
                  )}
                  <span style={{
                    display: "inline-flex", padding: "3px 10px", borderRadius: 12,
                    fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
                    background: sc.bg, color: sc.c, border: `1px solid ${sc.border}`,
                  }}>
                    {strikes} strike{strikes !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Stat bubbles */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                {stats.map(([v, l, c]) => (
                  <div key={l} style={{
                    textAlign: "center", background: D.bg3, borderRadius: 8,
                    padding: "10px 6px", border: `1px solid ${c ? `${c}25` : D.border}`,
                  }}>
                    <div style={{
                      fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                      color: c || D.text,
                    }}>{v}</div>
                    <div style={{
                      fontSize: 9, color: D.muted, marginTop: 2,
                      textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
                    }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unified attendance log */}
      <div style={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden" }}>
        {/* Log header + VA filter */}
        <div style={{
          padding: "11px 16px", borderBottom: `1px solid ${D.border}`,
          background: D.bg3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Attendance log — {monthLabel}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {["All", ...VAS].map((v) => (
              <button
                key={v}
                onClick={() => setFilterVa(v)}
                style={{
                  padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                  border: filterVa === v ? `1px solid ${D.blue}40` : "1px solid transparent",
                  background: filterVa === v ? D.bbg : "transparent",
                  color: filterVa === v ? D.blue : D.hint,
                  cursor: "pointer", fontFamily: "inherit", transition: "color 0.1s",
                }}
              >{v}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Date", "VA", "Late", "Absent", "Out of Zoom", "Notes", ""].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLog.length === 0
                ? (
                  <tr>
                    <td colSpan={7} style={{ ...td, textAlign: "center", color: D.hint, padding: "32px 16px" }}>
                      No entries{filterVa !== "All" ? ` for ${filterVa}` : ""} this month
                    </td>
                  </tr>
                )
                : filteredLog.map((e) => {
                  const fromMonday = e.id.startsWith("monday-");
                  return (
                    <tr key={e.id} className="qcl-row" style={{ background: D.bg2 }}>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div>
                            <div>{fmt(e.date)}</div>
                            {e.submittedPHT && (
                              <div style={{ fontSize: 10, color: D.hint, marginTop: 1 }}>
                                filed {e.submittedPHT} CST
                              </div>
                            )}
                          </div>
                          {fromMonday && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                              color: "#FF7D4F", background: "#FF7D4F18",
                              border: "1px solid #FF7D4F35", borderRadius: 4, padding: "1px 5px",
                            }}>MON</span>
                          )}
                        </div>
                      </td>
                      <td style={td}><VaChip va={e.va} /></td>
                      <td style={td}>{e.late
                        ? <span style={{ color: D.amber, fontWeight: 600 }}>Late</span>
                        : <span style={{ color: D.hint }}>—</span>}
                      </td>
                      <td style={td}>{e.absent ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ color: e.shortNotice ? D.red : D.green, fontWeight: 600 }}>
                            {e.shortNotice ? "Absent" : "Leave"}
                          </span>
                          {e.shortNotice && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: D.red,
                              background: `${D.red}18`, border: `1px solid ${D.red}35`,
                              borderRadius: 4, padding: "1px 5px", letterSpacing: "0.02em",
                            }}>⚠ short notice</span>
                          )}
                        </div>
                      ) : <span style={{ color: D.hint }}>—</span>}
                      </td>
                      <td style={td}>{e.ooz
                        ? <span style={{ color: D.amber, fontWeight: 600 }}>Yes</span>
                        : <span style={{ color: D.hint }}>—</span>}
                      </td>
                      <td style={{ ...td, color: D.muted, maxWidth: 260, fontSize: 12 }}>
                        {e.notes || <span style={{ color: D.hint }}>—</span>}
                      </td>
                      <td style={td}>
                        {fromMonday
                          ? <span style={{ fontSize: 11, color: D.hint }}>auto</span>
                          : <IB danger onClick={() => onDelAtt(e.id)}>✕</IB>
                        }
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
