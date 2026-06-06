"use client";
import React, { useState, useMemo } from "react";
import type { Client, RoundtableEvent } from "@/types";
import { VAS, STATUSES } from "@/lib/constants";
import { useTheme } from "@/lib/theme";
import { fmt } from "@/lib/utils";
import { IB, SPill, inp } from "./ui";

const VA_COLORS: Record<string, string | undefined> = {
  Peevee: "green", Rosalie: "purple", Aliah: "amber", Arvi: "blue", Claire: "red",
};

function cleanName(n: string) {
  return n.replace(/\s*\(copy\)\s*/gi, "").replace(/\s*\bcopy\b\s*$/gi, "").trim();
}

function resolveClient(mondayName: string, list: Client[]): string | null {
  const mn = cleanName(mondayName).toLowerCase();
  const match = list.find((c) => {
    const cn = c.name.toLowerCase().trim();
    if (cn === mn) return true;
    const parts = cn.split(" ").filter((p) => p.length > 2);
    return parts.length > 0 && parts.every((p) => mn.includes(p));
  });
  return match ? match.name : null;
}

export default function Clients({ clients, setModal, onDelete, onStatusChange, rtData }: {
  clients: Client[];
  setModal: (m: { type: string; id: string }) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  rtData: { boardName: string; events: RoundtableEvent[] } | null;
}) {
  const { D } = useTheme();
  const [q, setQ] = useState("");
  const [fva, setFva] = useState("");
  const [fst, setFst] = useState("");
  const [fErt, setFErt] = useState<"" | "scheduled" | "none">("");
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editStatus, setEditStatus] = useState<string | null>(null);

  const rtAttendees = useMemo(() => {
    const map = new Map<string, number>();
    if (!rtData?.events) return map;
    for (const ev of rtData.events) {
      const key = resolveClient(ev.clientName, clients);
      if (!key || ev.attendees == null) continue;
      map.set(key, (map.get(key) ?? 0) + ev.attendees);
    }
    return map;
  }, [rtData, clients]);

  const palette: Record<string, string> = {
    green: D.green, purple: D.purple, amber: D.amber,
    blue: D.blue, red: D.red, muted: D.muted,
  };

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const list = clients.filter((c) => {
    if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !(c.email || "").toLowerCase().includes(q.toLowerCase())) return false;
    if (fva && c.va !== fva) return false;
    if (fst && c.status !== fst) return false;
    if (fErt === "scheduled" && !c.ert) return false;
    if (fErt === "none" && c.ert) return false;
    return true;
  }).sort((a, b) => {
    // Stopped always at bottom, regardless of active sort
    const aStop = a.status === "Stopped" ? 1 : 0;
    const bStop = b.status === "Stopped" ? 1 : 0;
    if (aStop !== bStop) return aStop - bStop;
    if (!sortCol) return 0;
    let av: number | string = 0;
    let bv: number | string = 0;
    if (sortCol === "name") { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
    else if (sortCol === "ert") { av = a.ert || ""; bv = b.ert || ""; }
    else if (sortCol === "attendees") { av = rtAttendees.get(a.name) ?? a.attendees ?? 0; bv = rtAttendees.get(b.name) ?? b.attendees ?? 0; }
    else if (sortCol === "days") {
      av = a.ert ? new Date(a.ert + "T00:00:00").getTime() : 0;
      bv = b.ert ? new Date(b.ert + "T00:00:00").getTime() : 0;
    }
    if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const th: React.CSSProperties = {
    fontSize: 11, color: D.text, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.06em", padding: "10px 12px", textAlign: "left",
    borderBottom: `1px solid ${D.border}`, whiteSpace: "nowrap", background: D.bg3,
  };
  const td: React.CSSProperties = {
    padding: "14px 12px", borderBottom: `1px solid ${D.border}`, verticalAlign: "middle",
  };

  const SH = ({ col, label }: { col: string; label: string }) => (
    <th onClick={() => handleSort(col)} style={{ ...th, cursor: "pointer", userSelect: "none" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
        {label}
        <span style={{ fontSize: 9, color: sortCol === col ? D.blue : D.hint, opacity: sortCol === col ? 1 : 0.4 }}>
          {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </span>
    </th>
  );

  function daysTo(ert: string): number | null {
    if (!ert) return null;
    const t = new Date(ert + "T00:00:00");
    const n = new Date(); n.setHours(0, 0, 0, 0);
    return Math.round((t.getTime() - n.getTime()) / 864e5);
  }

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          style={{ ...inp, flex: 1, minWidth: 140, height: 33, padding: "0 9px" }}
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select style={{ ...inp, width: 120, height: 33, padding: "0 8px" }} value={fva} onChange={(e) => setFva(e.target.value)}>
          <option value="">All VAs</option>
          {VAS.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select style={{ ...inp, width: 155, height: 33, padding: "0 8px" }} value={fst} onChange={(e) => setFst(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select style={{ ...inp, width: 148, height: 33, padding: "0 8px" }} value={fErt} onChange={(e) => setFErt(e.target.value as "" | "scheduled" | "none")}>
          <option value="">All ERTs</option>
          <option value="scheduled">ERT scheduled</option>
          <option value="none">No ERT set</option>
        </select>
      </div>

      {/* Row count */}
      <div style={{ fontSize: 12, color: D.hint, marginBottom: 10 }}>
        Showing{" "}
        <span style={{ color: D.muted, fontWeight: 600 }}>{list.length}</span>
        {" "}of{" "}
        <span style={{ color: D.muted, fontWeight: 600 }}>{clients.length}</span>
        {" "}clients
        {list.filter((c) => c.redzone).length > 0 && (
          <span style={{ marginLeft: 10, color: D.red, fontWeight: 600 }}>
            · {list.filter((c) => c.redzone).length} on RedZone
          </span>
        )}
      </div>

      {!list.length
        ? <div style={{ textAlign: "center", padding: "36px 16px", color: D.muted }}>No clients found.</div>
        : (
          <div style={{ overflowX: "auto", border: `1px solid ${D.border}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <SH col="name" label="Client" />
                  <th style={th}>VA</th>
                  <th style={th}>Status</th>
                  <SH col="ert" label="Next ERT" />
                  <SH col="attendees" label="Attendees" />
                  <SH col="days" label="Days" />
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const vaColor = palette[VA_COLORS[c.va] || "muted"] || D.muted;
                  const att = rtAttendees.has(c.name) ? rtAttendees.get(c.name)! : (rtData == null ? null : (c.attendees || 0));
                  const attNum = att ?? 0;
                  const attColor = attNum === 0 ? D.hint : attNum < 8 ? D.amber : D.text;
                  const d = daysTo(c.ert);
                  const dColor = d === null ? D.hint : d < 0 ? D.red : d <= 7 ? D.red : d <= 14 ? D.amber : D.muted;
                  const dLabel = d === null ? "—" : d < 0 ? `${Math.abs(d)}d ago` : `${d}d`;

                  return (
                    <tr
                      key={c.id}
                      className="qcl-row"
                      onClick={() => { if (editStatus !== c.id) setModal({ type: "view", id: c.id }); }}
                      style={{ background: D.bg2, cursor: "pointer", opacity: c.status === "Stopped" ? 0.45 : 1 }}
                    >
                      {/* Client */}
                      <td style={td}>
                        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                          {c.name}
                          {c.redzone && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, letterSpacing: "0.03em",
                              color: D.red, background: `${D.red}15`,
                              border: `1px solid ${D.red}35`, borderRadius: 8, padding: "1px 6px",
                            }}>RZ</span>
                          )}
                        </div>
                        {c.email && <div style={{ fontSize: 11, color: D.hint, marginTop: 1 }}>{c.email}</div>}
                      </td>

                      {/* VA — colored text, no chip */}
                      <td style={td}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: vaColor }}>
                          {c.va || <span style={{ color: D.hint }}>—</span>}
                        </span>
                      </td>

                      {/* Status — dot + text, inline-editable */}
                      <td
                        style={td}
                        onClick={(e) => { e.stopPropagation(); setEditStatus(editStatus === c.id ? null : c.id); }}
                      >
                        {editStatus === c.id ? (
                          <select
                            autoFocus
                            value={c.status}
                            onBlur={() => setEditStatus(null)}
                            onChange={(e) => { onStatusChange(c.id, e.target.value); setEditStatus(null); }}
                            style={{
                              fontSize: 12, borderRadius: 8,
                              border: `1px solid ${D.border2}`, background: D.bg3,
                              color: D.text, padding: "4px 8px",
                              cursor: "pointer", fontFamily: "inherit", outline: "none",
                            }}
                          >
                            {STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span title="Click to change status" style={{ cursor: "pointer" }}>
                            <SPill s={c.status} />
                          </span>
                        )}
                      </td>

                      {/* ERT date */}
                      <td style={{ ...td, fontSize: 12, color: c.ert ? D.text : D.hint }}>
                        {c.ert ? (
                          <>
                            {fmt(c.ert)}
                            {c.ertTime && <div style={{ color: D.hint, fontSize: 11, marginTop: 1 }}>{c.ertTime}</div>}
                          </>
                        ) : "—"}
                      </td>

                      {/* Attendees — summed from Monday roundtable */}
                      <td style={td}>
                        {att === null
                          ? <span style={{ color: D.hint, fontSize: 11 }}>…</span>
                          : (
                            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: attNum >= 20 ? 600 : 400 }}>
                              <span style={{ color: attColor }}>{attNum}</span>
                              <span style={{ color: D.hint }}>/20</span>
                            </span>
                          )
                        }
                      </td>

                      {/* Days — color only for urgent */}
                      <td style={td}>
                        <span style={{
                          color: dColor,
                          fontWeight: d !== null && d <= 7 ? 600 : 400,
                          fontVariantNumeric: "tabular-nums",
                          fontSize: 12,
                        }}>{dLabel}</span>
                      </td>

                      {/* Actions */}
                      <td style={td} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <IB title="View" onClick={() => setModal({ type: "view", id: c.id })}>👁</IB>
                          <IB title="Edit" onClick={() => setModal({ type: "edit", id: c.id })}>✏</IB>
                          <IB title="Delete" danger onClick={() => onDelete(c.id)}>✕</IB>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}
