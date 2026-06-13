"use client";
import React, { useMemo } from "react";
import DEMO from "@/lib/demo";
import type { Client, RoundtableEvent } from "@/types";
import { useTheme } from "@/lib/theme";
import { fmt } from "@/lib/utils";
import { VaChip, SPill, Days } from "./ui";
import InboxPanel from "./InboxPanel";
import CalendarPanel from "./CalendarPanel";
import TaskPanel from "./TaskPanel";
import MeetingDraftPanel from "./MeetingDraftPanel";
import MondayNotificationsPanel from "./MondayNotificationsPanel";

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

export default function Overview({ clients, rtData, setModal, onAddNote }: {
  clients: Client[];
  rtData: { boardName: string; events: RoundtableEvent[] } | null;
  setModal: (m: { type: string; id: string }) => void;
  onAddNote: (clientId: string, text: string) => void;
}) {
  const { D } = useTheme();

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const m30 = new Date(); m30.setDate(m30.getDate() + 30);

  // Derive next ERT per client from live Roundtable data
  const rtNextErt = useMemo(() => {
    const map = new Map<string, { date: string; time: string; registered: number | null }>();
    if (!rtData?.events) return map;
    for (const ev of rtData.events) {
      if (!ev.date) continue;
      const d = new Date(ev.date + "T00:00:00");
      if (d < now) continue;
      const key = resolveClient(ev.clientName, clients);
      if (!key) continue;
      const existing = map.get(key);
      if (!existing || ev.date < existing.date)
        map.set(key, { date: ev.date, time: ev.rtTime || "", registered: ev.registered ?? null });
    }
    return map;
  }, [rtData, clients]);

  const upcoming = clients
    .filter((c) => {
      const ert = rtNextErt.get(c.name)?.date;
      if (!ert) return false;
      const d = new Date(ert + "T00:00:00");
      return d >= now && d <= m30;
    })
    .sort((a, b) => {
      const ad = rtNextErt.get(a.name)?.date || "";
      const bd = rtNextErt.get(b.name)?.date || "";
      return ad.localeCompare(bd);
    });

  const th: React.CSSProperties = {
    fontSize: 11, color: D.muted, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.05em", padding: "8px 10px", textAlign: "left",
    borderBottom: `1px solid ${D.border}`, whiteSpace: "nowrap", background: D.bg3,
  };
  const td: React.CSSProperties = { padding: "9px 10px", borderBottom: `1px solid ${D.border}`, verticalAlign: "middle" };

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

      {/* ── Left column: Upcoming ERTs + Tasks ── */}
      <div style={{ flex: "0 0 44%", display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Upcoming ERTs — blue */}
      <div style={{ background: D.bg2, border: `1px solid ${D.blue}60`, borderRadius: 12, overflow: "hidden", boxShadow: `0 0 0 1px ${D.blue}15, 0 4px 20px ${D.blue}12` }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${D.blue}25`, background: `linear-gradient(135deg, ${D.blue}22 0%, ${D.blue}10 100%)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15 }}>📋</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: D.blue, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Upcoming ERTs
            </span>
          </div>
          <span style={{ fontSize: 10, color: D.blue, background: `${D.blue}25`, border: `1px solid ${D.blue}50`, borderRadius: 9, padding: "2px 8px", fontWeight: 700 }}>
            {upcoming.length} in 30 days
          </span>
        </div>

        {!upcoming.length
          ? <div style={{ padding: "36px 16px", textAlign: "center", color: D.muted, fontSize: 13 }}>No ERTs scheduled in the next 30 days.</div>
          : (
            <div style={{ overflowY: "auto", maxHeight: 460 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Client", "VA", "ERT date", "Days", "Registered", "Status"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((c) => {
                    const entry = rtNextErt.get(c.name)!;
                    const dayName = new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" });
                    const reg = entry.registered;
                    return (
                      <tr key={c.id} className="qcl-row" onClick={() => setModal({ type: "view", id: c.id })} style={{ cursor: "pointer", background: D.bg2 }}>
                        <td style={td}><strong style={{ fontWeight: 600 }}>{c.name}</strong></td>
                        <td style={td}><VaChip va={c.va} /></td>
                        <td style={{ ...td, fontSize: 12 }}>
                          <span style={{ color: D.muted, fontSize: 11 }}>{dayName}, </span>{fmt(entry.date)}
                          {entry.time && <div style={{ color: D.hint, fontSize: 11 }}>{entry.time}</div>}
                        </td>
                        <td style={td}><Days ert={entry.date} /></td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: reg == null ? D.hint : reg > 0 ? D.green : D.hint }}>
                            {reg == null ? "—" : reg}
                          </span>
                        </td>
                        <td style={td}><SPill s={c.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* Tasks panel — below ERTs */}
      <TaskPanel />

      {/* Monday Notifications panel — below Tasks */}
      <MondayNotificationsPanel />

      </div>{/* end left column */}

      {/* ── Right column: Calendar | (Inbox + Meeting Draft stacked) ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 14, alignItems: "flex-start" }}>
        {!DEMO && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <CalendarPanel accent={D.green} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {!DEMO && <InboxPanel />}
          <MeetingDraftPanel clients={clients} onAddNote={onAddNote} />
        </div>
      </div>

    </div>
  );
}
