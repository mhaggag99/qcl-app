"use client";
import React, { useState, useMemo } from "react";
import type { Client, RoundtableEvent } from "@/types";
import { VAS, STATUSES } from "@/lib/constants";
import { useTheme } from "@/lib/theme";
import { fmt } from "@/lib/utils";
import { IB, SPill, inp } from "./ui";

const VA_COLORS: Record<string, string | undefined> = {
  Janine: "red", Meliza: "purple", Charlene: "amber", Markjones: "blue",
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

export default function Clients({ clients, setModal, onDelete, onStatusChange, rtData, onRefreshRt, rtLoading }: {
  clients: Client[];
  setModal: (m: { type: string; id: string }) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  rtData: { boardName: string; events: RoundtableEvent[] } | null;
  onRefreshRt: () => void;
  rtLoading: boolean;
}) {
  const { D } = useTheme();
  const [q, setQ] = useState("");
  const [fva, setFva] = useState("");
  const [fst, setFst] = useState("");
  const [fErt, setFErt] = useState<"" | "scheduled" | "none">("");
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [showStopped, setShowStopped] = useState(false);

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

  const rtLastErt = useMemo(() => {
    const map = new Map<string, string>();
    if (!rtData?.events) return map;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const ev of rtData.events) {
      if (!ev.date) continue;
      const d = new Date(ev.date + "T00:00:00");
      if (d >= today) continue;
      const key = resolveClient(ev.clientName, clients);
      if (!key) continue;
      const existing = map.get(key);
      if (!existing || ev.date > existing) map.set(key, ev.date);
    }
    return map;
  }, [rtData, clients]);

  const rtNextErt = useMemo(() => {
    const map = new Map<string, { date: string; time: string; registered: number | null }>();
    if (!rtData?.events) return map;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const ev of rtData.events) {
      if (!ev.date) continue;
      const d = new Date(ev.date + "T00:00:00");
      if (d < today) continue;
      const key = resolveClient(ev.clientName, clients);
      if (!key) continue;
      const existing = map.get(key);
      if (!existing || ev.date < existing.date) map.set(key, { date: ev.date, time: ev.rtTime || "", registered: ev.registered ?? null });
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

  function applyFilters(c: Client) {
    if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !(c.email || "").toLowerCase().includes(q.toLowerCase())) return false;
    if (fva && c.va !== fva) return false;
    const nextErt = rtNextErt.get(c.name)?.date;
    if (fErt === "scheduled" && !nextErt) return false;
    if (fErt === "none" && nextErt) return false;
    return true;
  }

  function applySort(arr: Client[]) {
    return [...arr].sort((a, b) => {
      if (!sortCol) return 0;
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortCol === "name") { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (sortCol === "va") { av = a.va.toLowerCase(); bv = b.va.toLowerCase(); }
      else if (sortCol === "status") { av = a.status.toLowerCase(); bv = b.status.toLowerCase(); }
      else if (sortCol === "ert") {
        av = rtNextErt.get(a.name)?.date || "";
        bv = rtNextErt.get(b.name)?.date || "";
      }
      else if (sortCol === "attendees") { av = rtAttendees.get(a.name) ?? a.attendees ?? 0; bv = rtAttendees.get(b.name) ?? b.attendees ?? 0; }
      else if (sortCol === "days") {
        const ad = rtNextErt.get(a.name)?.date;
        const bd = rtNextErt.get(b.name)?.date;
        av = ad ? new Date(ad + "T00:00:00").getTime() : Infinity;
        bv = bd ? new Date(bd + "T00:00:00").getTime() : Infinity;
      }
      else if (sortCol === "lastErt") {
        av = rtLastErt.get(a.name) || "";
        bv = rtLastErt.get(b.name) || "";
      }
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }

  const activeClients = clients.filter((c) => c.status !== "Stopped");
  const list = applySort(activeClients.filter((c) => applyFilters(c) && (fst ? c.status === fst : true)));
  const stoppedList = clients.filter((c) => c.status === "Stopped" && applyFilters(c));

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

      {/* Row count + refresh */}
      <div style={{ fontSize: 12, color: D.hint, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <span>
          Showing{" "}
          <span style={{ color: D.muted, fontWeight: 600 }}>{list.length}</span>
          {" "}of{" "}
          <span style={{ color: D.muted, fontWeight: 600 }}>{activeClients.length}</span>
          {" "}active clients
        </span>
        {list.filter((c) => c.redzone).length > 0 && (
          <span style={{ color: D.red, fontWeight: 600 }}>
            · {list.filter((c) => c.redzone).length} on RedZone
          </span>
        )}
        {stoppedList.length > 0 && (
          <span style={{ color: D.hint }}>· {stoppedList.length} inactive</span>
        )}
        <button
          onClick={onRefreshRt}
          disabled={rtLoading}
          title="Refresh Roundtable data"
          style={{
            marginLeft: "auto", background: "none", border: `1px solid ${D.border}`,
            borderRadius: 6, padding: "3px 9px", cursor: rtLoading ? "default" : "pointer",
            color: rtLoading ? D.hint : D.muted, fontSize: 11, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span style={{ display: "inline-block", animation: rtLoading ? "spin 1s linear infinite" : "none" }}>↻</span>
          {rtLoading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {!list.length && !stoppedList.length
        ? <div style={{ textAlign: "center", padding: "36px 16px", color: D.muted }}>No clients found.</div>
        : (
          <div style={{ overflowX: "auto", border: `1px solid ${D.border}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <SH col="name" label="Client" />
                  <SH col="va" label="VA" />
                  <SH col="status" label="Status" />
                  <SH col="days" label="Next ERT" />
                  <SH col="lastErt" label="Last ERT" />
                  <SH col="attendees" label="Attendees" />
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {!list.length && (
                  <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: D.muted, fontSize: 13 }}>No active clients match your filters.</td></tr>
                )}
                {list.map((c) => {
                  const vaColor = palette[VA_COLORS[c.va] || "muted"] || D.muted;
                  const att = rtAttendees.has(c.name) ? rtAttendees.get(c.name)! : (rtData == null ? null : (c.attendees || 0));
                  const attNum = att ?? 0;
                  const attColor = attNum === 0 ? D.hint : attNum < 8 ? D.amber : D.text;
                  const nextErtEntry = rtNextErt.get(c.name);
                  const nextErtDate = nextErtEntry?.date || null;
                  const nextErtTime = nextErtEntry?.time || null;
                  const nextErtReg = nextErtEntry?.registered ?? null;
                  const d = daysTo(nextErtDate || "");
                  const dColor = d === null ? D.hint : d <= 7 ? D.red : d <= 14 ? D.amber : D.green;
                  const dLabel = d === null ? "—" : d === 0 ? "Today" : `${d}d`;
                  const lastErtDate = rtLastErt.get(c.name) || null;

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

                      {/* Next ERT — from live Roundtable data */}
                      <td style={{ ...td, fontSize: 12 }}>
                        {nextErtDate ? (
                          <>
                            <span style={{ color: D.text }}>{fmt(nextErtDate)}</span>
                            {nextErtTime && <div style={{ color: D.hint, fontSize: 11 }}>{nextErtTime}</div>}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                              <span style={{ color: dColor, fontWeight: d !== null && d <= 14 ? 600 : 400, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                                {dLabel}
                              </span>
                              {nextErtReg !== null && (
                                <span style={{
                                  fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                                  color: nextErtReg === 0 ? D.muted : nextErtReg < 5 ? D.amber : D.blue,
                                  background: nextErtReg === 0 ? `${D.hint}18` : nextErtReg < 5 ? `${D.amber}20` : `${D.blue}20`,
                                  border: `1px solid ${nextErtReg === 0 ? D.hint : nextErtReg < 5 ? D.amber : D.blue}35`,
                                  borderRadius: 6, padding: "2px 7px",
                                }}>
                                  {nextErtReg} reg
                                </span>
                              )}
                            </div>
                          </>
                        ) : <span style={{ color: D.hint }}>—</span>}
                      </td>

                      {/* Last ERT — from Roundtable data */}
                      <td style={{ ...td, fontSize: 12, color: lastErtDate ? D.muted : D.hint }}>
                        {lastErtDate ? fmt(lastErtDate) : "—"}
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

      {/* Stopped / Inactive clients — collapsible */}
      {stoppedList.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowStopped((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "none", border: `1px solid ${D.border}`,
              borderRadius: 8, padding: "7px 14px", cursor: "pointer",
              color: D.muted, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              width: "100%", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 10, transition: "transform 0.15s", display: "inline-block", transform: showStopped ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
            Inactive / Stopped ({stoppedList.length})
          </button>
          {showStopped && (
            <div style={{ marginTop: 8, border: `1px solid ${D.border}`, borderRadius: 10, overflow: "hidden", opacity: 0.7 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {stoppedList.map((c) => {
                    const vaColor = palette[VA_COLORS[c.va] || "muted"] || D.muted;
                    return (
                      <tr key={c.id} className="qcl-row" onClick={() => setModal({ type: "view", id: c.id })}
                        style={{ background: D.bg2, cursor: "pointer" }}>
                        <td style={td}>
                          <span style={{ fontWeight: 600 }}>{c.name}</span>
                          {c.email && <div style={{ fontSize: 11, color: D.hint, marginTop: 1 }}>{c.email}</div>}
                        </td>
                        <td style={td}><span style={{ fontSize: 12, fontWeight: 600, color: vaColor }}>{c.va || <span style={{ color: D.hint }}>—</span>}</span></td>
                        <td style={td}><SPill s={c.status} /></td>
                        <td style={{ ...td, fontSize: 12, color: D.hint }}>{c.ert ? fmt(c.ert) : "—"}</td>
                        <td style={td} />
                        <td style={td} />
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
          )}
        </div>
      )}
    </div>
  );
}
