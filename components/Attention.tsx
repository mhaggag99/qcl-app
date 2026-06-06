"use client";
import React from "react";
import type { Client } from "@/types";
import { useTheme } from "@/lib/theme";
import { daysTo, fmt } from "@/lib/utils";
import { B, VaChip, SPill } from "./ui";

function ERTCard({ c, D, setModal }: {
  c: Client;
  D: ReturnType<typeof useTheme>["D"];
  setModal: (m: { type: string; id: string }) => void;
}) {
  const d = daysTo(c.ert);
  const overdue = d !== null && d < 0;
  const urgent = d !== null && d <= 3;
  const att = c.attendees || 0;
  const pct = Math.min(100, Math.round((att / 20) * 100));
  const attColor = att >= 20 ? D.green : att >= 12 ? D.amber : D.red;
  const accentColor = overdue ? D.red : urgent ? D.amber : D.blue;
  const lastNote = c.notes?.filter((n) => !n.done).slice(-1)[0];

  return (
    <div className="qcl-card" style={{
      background: D.bg2,
      border: `1px solid ${D.border}`,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        {/* Left: identity + ERT */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: D.text, letterSpacing: "-0.01em" }}>{c.name}</span>
            <VaChip va={c.va} />
            <SPill s={c.status} />
            {c.flag && (
              <span style={{ fontSize: 10, fontWeight: 700, color: D.amber, background: `${D.amber}15`, border: `1px solid ${D.amber}35`, borderRadius: 8, padding: "1px 6px" }}>
                ⚑ {c.flag}
              </span>
            )}
            {c.redzone && (
              <span style={{ fontSize: 10, fontWeight: 700, color: D.red, background: `${D.red}15`, border: `1px solid ${D.red}35`, borderRadius: 8, padding: "1px 6px" }}>RZ</span>
            )}
          </div>

          {/* ERT + attendees row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {/* Days countdown */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: accentColor, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", lineHeight: 1 }}>
                {d === null ? "—" : overdue ? `${Math.abs(d)}d ago` : `${d}d`}
              </span>
              {c.ert && (
                <span style={{ fontSize: 11, color: D.muted }}>
                  {overdue ? "overdue" : "to ERT"} · {fmt(c.ert)}{c.ertTime ? ` ${c.ertTime}` : ""}
                </span>
              )}
            </div>

            {/* Attendees bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 72, height: 5, borderRadius: 3, background: D.bg3, overflow: "hidden", border: `1px solid ${D.border}` }}>
                <div style={{ height: "100%", width: `${pct}%`, background: attColor, borderRadius: 3, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 12, color: attColor, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{att}<span style={{ color: D.hint, fontWeight: 400 }}>/20</span></span>
            </div>
          </div>

          {/* Last note */}
          {lastNote && (
            <div style={{ marginTop: 7, fontSize: 12, color: D.muted, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 440 }}>
              {lastNote.title && <span style={{ fontWeight: 600, color: D.text }}>{lastNote.title}: </span>}
              {lastNote.text}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 5, flexShrink: 0, marginTop: 2 }}>
          <B sm onClick={() => setModal({ type: "view", id: c.id })}>View</B>
          <B sm onClick={() => setModal({ type: "edit", id: c.id })}>Edit</B>
        </div>
      </div>
    </div>
  );
}

function Section({ title, color, clients, D, setModal }: {
  title: string; color: string; clients: Client[];
  D: ReturnType<typeof useTheme>["D"];
  setModal: (m: { type: string; id: string }) => void;
}) {
  if (!clients.length) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
        <span style={{ fontSize: 10, color, background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 8, padding: "1px 7px", fontWeight: 700 }}>{clients.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {clients.map((c) => <ERTCard key={c.id} c={c} D={D} setModal={setModal} />)}
      </div>
    </div>
  );
}

export default function Attention({ clients, setModal }: {
  clients: Client[];
  setModal: (m: { type: string; id: string }) => void;
}) {
  const { D } = useTheme();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(); week.setDate(week.getDate() + 7); week.setHours(23, 59, 59, 999);

  const active = clients.filter((c) => c.status !== "Stopped");

  const thisWeek = active.filter((c) => {
    if (!c.ert) return false;
    const d = new Date(c.ert + "T00:00:00");
    return d >= today && d <= week;
  }).sort((a, b) => new Date(a.ert).getTime() - new Date(b.ert).getTime());

  const overdue = active.filter((c) => {
    if (!c.ert) return false;
    return new Date(c.ert + "T00:00:00") < today;
  }).sort((a, b) => new Date(b.ert).getTime() - new Date(a.ert).getTime());

  const atRisk = active.filter((c) => {
    const inThisWeek = c.ert && new Date(c.ert + "T00:00:00") >= today && new Date(c.ert + "T00:00:00") <= week;
    const isOverdue = c.ert && new Date(c.ert + "T00:00:00") < today;
    return !inThisWeek && !isOverdue && (c.status === "At Risk" || (c.flag && c.flag.trim()));
  });

  const total = thisWeek.length + overdue.length + atRisk.length;

  if (!total) return (
    <div style={{ textAlign: "center", padding: "56px 16px", color: D.muted, fontSize: 13 }}>
      <div style={{ fontSize: 24, marginBottom: 10 }}>✓</div>
      No ERTs this week and no at-risk clients.
    </div>
  );

  return (
    <div>
      <Section title="This week" color={D.blue} clients={thisWeek} D={D} setModal={setModal} />
      <Section title="Overdue" color={D.red} clients={overdue} D={D} setModal={setModal} />
      <Section title="At risk / flagged" color={D.amber} clients={atRisk} D={D} setModal={setModal} />
    </div>
  );
}
