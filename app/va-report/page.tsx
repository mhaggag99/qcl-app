"use client";
import React, { useState, useEffect } from "react";
import { VAS } from "@/lib/constants";
import type { Client } from "@/types";

const PMS = ["Marwan"];

function today() {
  return new Date().toISOString().split("T")[0];
}

const inp: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: 7, fontSize: 13,
  border: "1px solid #1c2f50", background: "#060810", color: "#e2eaf8",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box", textAlign: "center",
};

const colHdr: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "#4a6080", textTransform: "uppercase",
  letterSpacing: "0.06em", textAlign: "center", padding: "0 4px",
};

type EntryRow = {
  connReq: string; inmails: string; liInvites: string;
  interested: string; registeredErt: string;
};

type RowResult = { status: "idle" | "ok" | "duplicate" | "error"; msg?: string };

export default function VaReport() {
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [va, setVa] = useState("");
  const [pm, setPm] = useState(PMS[0]);
  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState<Record<string, EntryRow>>({});
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [submitting, setSubmitting] = useState(false);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then(setAllClients);
  }, []);

  const vaClients = allClients.filter(
    (c) => c.va === va && c.status !== "Stopped"
  );

  useEffect(() => {
    if (!va) return;
    const init: Record<string, EntryRow> = {};
    vaClients.forEach((c) => {
      init[c.id] = { connReq: "", inmails: "", liInvites: "", interested: "", registeredErt: "" };
    });
    setEntries(init);
    setResults({});
    setAllDone(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [va, allClients]);

  function setField(clientId: string, field: keyof EntryRow, value: string) {
    setEntries((prev) => ({ ...prev, [clientId]: { ...prev[clientId], [field]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!va || vaClients.length === 0) return;
    setSubmitting(true);
    const newResults: Record<string, RowResult> = {};

    for (const c of vaClients) {
      const row = entries[c.id];
      if (!row) continue;
      const allEmpty = !row.connReq && !row.inmails && !row.liInvites && !row.interested && !row.registeredErt;
      if (allEmpty) { newResults[c.id] = { status: "idle" }; continue; }

      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, va, clientId: c.id, clientName: c.name, pmName: pm,
          connReqSent: row.connReq, inmailsSent: row.inmails, liEventInvites: row.liInvites,
          interested: row.interested, registeredErt: row.registeredErt,
        }),
      });
      if (res.status === 409) newResults[c.id] = { status: "duplicate" };
      else if (!res.ok) newResults[c.id] = { status: "error", msg: "Failed" };
      else newResults[c.id] = { status: "ok" };
    }

    setResults(newResults);
    setSubmitting(false);
    const hasOk = Object.values(newResults).some((r) => r.status === "ok");
    if (hasOk) setAllDone(true);
  }

  const statusBadge = (r: RowResult) => {
    if (r.status === "ok") return <span style={{ fontSize: 11, color: "#0fcf8a", fontWeight: 600 }}>✓ Saved</span>;
    if (r.status === "duplicate") return <span style={{ fontSize: 11, color: "#ffab1a", fontWeight: 600 }}>Already submitted today</span>;
    if (r.status === "error") return <span style={{ fontSize: 11, color: "#ff4d6a", fontWeight: 600 }}>Error</span>;
    return null;
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#060810",
      fontFamily: "'Inter', -apple-system, sans-serif", padding: "32px 20px",
    }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, margin: "0 auto 12px",
            background: "linear-gradient(135deg, rgba(75,163,255,0.14), rgba(139,92,246,0.14))",
            border: "1px solid rgba(75,163,255,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="url(#g1)" strokeWidth="1.4" strokeLinejoin="round" />
              <defs>
                <linearGradient id="g1" x1="2.5" y1="1.5" x2="13.5" y2="14.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4ba3ff" /><stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#e2eaf8", letterSpacing: "-0.02em" }}>Daily Activity Report</div>
          <div style={{ fontSize: 13, color: "#4a6080", marginTop: 3 }}>QCL Project Manager</div>
        </div>

        {/* Top controls */}
        <div style={{
          background: "#090d1c", border: "1px solid #111d36", borderRadius: 12,
          padding: "20px 22px", marginBottom: 16,
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
        }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Your Name (VA)</label>
            <select value={va} onChange={(e) => setVa(e.target.value)} style={{ ...inp, textAlign: "left" }}>
              <option value="">Select VA...</option>
              {VAS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>PM</label>
            <select value={pm} onChange={(e) => setPm(e.target.value)} style={{ ...inp, textAlign: "left" }}>
              {PMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inp, textAlign: "left" }} />
          </div>
        </div>

        {/* Client rows */}
        {va && (
          <form onSubmit={handleSubmit}>
            {vaClients.length === 0 ? (
              <div style={{ background: "#090d1c", border: "1px solid #111d36", borderRadius: 12, padding: 32, textAlign: "center", color: "#4a6080", fontSize: 13 }}>
                No active clients assigned to {va}.
              </div>
            ) : (
              <div style={{ background: "#090d1c", border: "1px solid #111d36", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>

                {/* Column headers */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr 1fr 1fr 1fr 1fr 100px",
                  gap: 8, padding: "10px 16px",
                  borderBottom: "1px solid #111d36", background: "#0f1628",
                }}>
                  <div style={{ ...colHdr, textAlign: "left" }}>Client</div>
                  <div style={colHdr}>Conn. Requests</div>
                  <div style={colHdr}>InMails</div>
                  <div style={colHdr}>LI Invites</div>
                  <div style={colHdr}>Interested</div>
                  <div style={colHdr}>Registered</div>
                  <div style={colHdr}>Status</div>
                </div>

                {/* One row per client */}
                {vaClients.map((c, i) => {
                  const row = entries[c.id] || { connReq: "", inmails: "", liInvites: "", interested: "", registeredErt: "" };
                  const res = results[c.id];
                  const isDone = res?.status === "ok";
                  return (
                    <div key={c.id} style={{
                      display: "grid",
                      gridTemplateColumns: "200px 1fr 1fr 1fr 1fr 1fr 100px",
                      gap: 8, padding: "10px 16px", alignItems: "center",
                      borderBottom: i < vaClients.length - 1 ? "1px solid #0f1628" : "none",
                      background: isDone ? "rgba(15,207,138,0.04)" : "transparent",
                      opacity: isDone ? 0.7 : 1,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2eaf8", paddingRight: 8 }}>
                        {c.name}
                        {c.ert && <div style={{ fontSize: 10, color: "#4a6080", fontWeight: 400, marginTop: 2 }}>ERT: {c.ert}</div>}
                      </div>
                      {(["connReq", "inmails", "liInvites", "interested", "registeredErt"] as (keyof EntryRow)[]).map((field) => (
                        <input
                          key={field}
                          type="number" min={0}
                          value={row[field]}
                          onChange={(e) => setField(c.id, field, e.target.value)}
                          placeholder="0"
                          disabled={isDone}
                          style={{ ...inp, opacity: isDone ? 0.5 : 1 }}
                        />
                      ))}
                      <div style={{ textAlign: "center", minHeight: 20 }}>
                        {res ? statusBadge(res) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {vaClients.length > 0 && (
              <button type="submit" disabled={submitting} style={{
                width: "100%", padding: "12px", borderRadius: 9, fontSize: 14, fontWeight: 600,
                background: submitting ? "rgba(75,163,255,0.08)" : "linear-gradient(135deg, rgba(75,163,255,0.18), rgba(139,92,246,0.18))",
                border: "1px solid rgba(75,163,255,0.3)",
                color: submitting ? "#4a6080" : "#4ba3ff",
                cursor: submitting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}>
                {submitting ? "Submitting..." : allDone ? "✓ Submitted — Submit again to update" : `Submit Report for ${va}`}
              </button>
            )}
          </form>
        )}

        {!va && (
          <div style={{ background: "#090d1c", border: "1px solid #111d36", borderRadius: 12, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>👆</div>
            <div style={{ color: "#4a6080", fontSize: 14 }}>Select your name above to see your clients</div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#192640" }}>
          QCL Project Manager • Daily VA Report
        </div>
      </div>
    </div>
  );
}
