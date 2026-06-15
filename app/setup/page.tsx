"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { QCLFull } from "@/components/QCLLogo";

const C = {
  bg:     "#060810", bg2:    "#090d1c", bg3:   "#0f1628",
  border: "#111d36", border2:"#1c2f50",
  text:   "#e2eaf8", muted:  "#4a6080",
  green:  "#3DFF3D", amber:  "#ffab1a",
  red:    "#ff4d6a", blue:   "#4ba3ff",
};

const STATUSES = ["New Client", "Performing", "Slow Generating", "At Risk", "Stopped"];
const STATUS_COLOR: Record<string, string> = {
  "New Client": C.blue, "Performing": C.green,
  "Slow Generating": C.amber, "At Risk": C.red, "Stopped": C.muted,
};

interface ClientRow {
  id: string;
  name: string;
  va: string;
  status: string;
  ert: string;
  attendees: number;
  flag: string;
}

function mkRow(va: string): ClientRow {
  return { id: Math.random().toString(36).slice(2), name: "", va, status: "New Client", ert: "", attendees: 0, flag: "" };
}

const inp: React.CSSProperties = {
  background: C.bg3, border: `1px solid ${C.border2}`, borderRadius: 8,
  color: C.text, fontSize: 14, outline: "none", padding: "9px 12px",
  boxSizing: "border-box" as const,
};

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [userName, setUserName] = useState("");
  const [vas, setVas] = useState<string[]>([]);
  const [vaInput, setVaInput] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const vaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user) setUserName(d.user.name?.split(" ")[0] ?? "");
    });
  }, []);

  function addVA() {
    const v = vaInput.trim();
    if (!v || vas.includes(v)) return;
    setVas(prev => [...prev, v]);
    setVaInput("");
    vaRef.current?.focus();
  }

  function removeVA(v: string) {
    setVas(prev => prev.filter(x => x !== v));
    setClients(prev => prev.map(c => c.va === v ? { ...c, va: "" } : c));
  }

  function addClient() {
    setClients(prev => [...prev, mkRow(vas[0] ?? "")]);
  }

  function updateClient(id: string, patch: Partial<ClientRow>) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  function removeClient(id: string) {
    setClients(prev => prev.filter(c => c.id !== id));
  }

  function goToStep2() {
    if (vas.length === 0) { setError("Add at least one VA to continue."); return; }
    setError("");
    if (clients.length === 0) setClients([mkRow(vas[0])]);
    setStep(2);
  }

  async function submit() {
    const named = clients.filter(c => c.name.trim());
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vas, clients: named }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Setup failed"); }
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter', -apple-system, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px 60px" }}>
      <style>{`
        @keyframes setup-fade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .setup-in { animation: setup-fade 0.35s ease both; }
        .setup-va-chip:hover { border-color: ${C.red} !important; background: rgba(255,77,106,0.08) !important; }
        .setup-va-chip:hover .rm { opacity: 1 !important; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
      `}</style>

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 680, paddingTop: 40, marginBottom: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <QCLFull height={52} dark />
        <div style={{ fontSize: 12, color: C.muted }}>
          <span style={{ color: step === 1 ? C.text : C.muted, fontWeight: step === 1 ? 600 : 400 }}>1. VAs</span>
          <span style={{ margin: "0 8px", color: C.border2 }}>→</span>
          <span style={{ color: step === 2 ? C.text : C.muted, fontWeight: step === 2 ? 600 : 400 }}>2. Clients</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: "100%", maxWidth: 680, height: 3, background: C.border, borderRadius: 4, marginBottom: 48, overflow: "hidden" }}>
        <div style={{ height: "100%", width: step === 1 ? "50%" : "100%", background: C.green, borderRadius: 4, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>

      {/* ── Step 1: VAs ─────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="setup-in" style={{ width: "100%", maxWidth: 520 }}>
          <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: C.green }}>Step 1 of 2</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>
            {userName ? `Welcome, ${userName}` : "Welcome"} 👋
          </h1>
          <p style={{ margin: "0 0 36px", fontSize: 15, color: C.muted, lineHeight: 1.6 }}>
            Let's set up your workspace. Start by adding the Virtual Assistants on your team — you'll assign clients to them in the next step.
          </p>

          {/* VA input */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              ref={vaRef}
              style={{ ...inp, flex: 1, fontSize: 15 }}
              placeholder="VA first name (e.g. Rosalie)"
              value={vaInput}
              onChange={e => setVaInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addVA()}
            />
            <button onClick={addVA} style={{
              padding: "9px 20px", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer", flexShrink: 0,
              background: vaInput.trim() ? "rgba(61,255,61,0.15)" : "transparent",
              border: `1px solid ${vaInput.trim() ? C.green : C.border2}`,
              color: vaInput.trim() ? C.green : C.muted,
              transition: "all 0.15s",
            }}>+ Add</button>
          </div>

          {/* VA chips */}
          {vas.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36 }}>
              {vas.map(v => (
                <div key={v} className="setup-va-chip" style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 12px 7px 14px", borderRadius: 24,
                  background: "rgba(61,255,61,0.08)", border: `1px solid rgba(61,255,61,0.25)`,
                  fontSize: 14, fontWeight: 600, color: C.green, cursor: "default", transition: "all 0.15s",
                }}>
                  {v}
                  <span className="rm" onClick={() => removeVA(v)} style={{
                    cursor: "pointer", color: C.red, fontSize: 16, lineHeight: 1, opacity: 0.5,
                    transition: "opacity 0.15s", userSelect: "none",
                  }}>×</span>
                </div>
              ))}
            </div>
          )}

          {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <button onClick={goToStep2} style={{
            width: "100%", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer",
            background: vas.length > 0 ? "rgba(61,255,61,0.12)" : "transparent",
            border: `1px solid ${vas.length > 0 ? C.green : C.border2}`,
            color: vas.length > 0 ? C.green : C.muted,
            transition: "all 0.2s",
          }}>
            Continue → Add Clients
          </button>
        </div>
      )}

      {/* ── Step 2: Clients ──────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="setup-in" style={{ width: "100%", maxWidth: 680 }}>
          <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: C.green }}>Step 2 of 2</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>Your Client Portfolio</h1>
          <p style={{ margin: "0 0 28px", fontSize: 15, color: C.muted, lineHeight: 1.6 }}>
            Add your clients and assign each one to a VA. You can always add more after you're in.
          </p>

          {/* Client rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            {clients.map((c, idx) => (
              <div key={c.id} style={{
                background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: "14px 16px", position: "relative",
                borderLeft: `3px solid ${STATUS_COLOR[c.status] ?? C.muted}`,
              }}>
                {/* Client name */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: C.muted, width: 22, textAlign: "right", flexShrink: 0 }}>{idx + 1}.</span>
                  <input
                    style={{ ...inp, flex: 1, fontSize: 15, fontWeight: 600 }}
                    placeholder="Client name"
                    value={c.name}
                    onChange={e => updateClient(c.id, { name: e.target.value })}
                    autoFocus={idx === clients.length - 1 && clients.length > 0}
                  />
                  <button onClick={() => removeClient(c.id)} style={{
                    background: "none", border: "none", color: C.muted, fontSize: 20,
                    cursor: "pointer", padding: "0 4px", flexShrink: 0, lineHeight: 1,
                  }}>×</button>
                </div>

                {/* Fields row */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingLeft: 30 }}>
                  {/* VA */}
                  <select value={c.va} onChange={e => updateClient(c.id, { va: e.target.value })}
                    style={{ ...inp, minWidth: 110 }}>
                    <option value="">— VA —</option>
                    {vas.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>

                  {/* Status */}
                  <select value={c.status} onChange={e => updateClient(c.id, { status: e.target.value })}
                    style={{ ...inp, color: STATUS_COLOR[c.status] ?? C.text, minWidth: 130 }}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  {/* ERT date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>Next ERT</span>
                    <input type="date" value={c.ert} onChange={e => updateClient(c.id, { ert: e.target.value })}
                      style={{ ...inp, width: 140 }} />
                  </div>

                  {/* Attendees */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>Att.</span>
                    <input type="number" min={0} value={c.attendees}
                      onChange={e => updateClient(c.id, { attendees: parseInt(e.target.value) || 0 })}
                      style={{ ...inp, width: 60, textAlign: "center" }} />
                  </div>

                  {/* Flag */}
                  <input style={{ ...inp, flex: 1, minWidth: 130 }} placeholder="Flag / note (optional)"
                    value={c.flag} onChange={e => updateClient(c.id, { flag: e.target.value })} />
                </div>
              </div>
            ))}
          </div>

          <button onClick={addClient} style={{
            width: "100%", padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 32,
            background: "transparent", border: `1px dashed ${C.border2}`, color: C.muted,
            transition: "all 0.15s",
          }}>+ Add Client</button>

          {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

          {/* Summary */}
          {clients.filter(c => c.name.trim()).length > 0 && (
            <div style={{ marginBottom: 20, padding: "12px 16px", background: "rgba(61,255,61,0.05)", border: `1px solid rgba(61,255,61,0.15)`, borderRadius: 10, fontSize: 13, color: C.muted }}>
              Ready to import <strong style={{ color: C.green }}>{clients.filter(c => c.name.trim()).length} client{clients.filter(c => c.name.trim()).length !== 1 ? "s" : ""}</strong> across{" "}
              <strong style={{ color: C.text }}>{new Set(clients.filter(c => c.name.trim() && c.va).map(c => c.va)).size} VA{new Set(clients.filter(c => c.name.trim() && c.va).map(c => c.va)).size !== 1 ? "s" : ""}</strong>.
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setStep(1); setError(""); }} style={{
              flex: "0 0 auto", padding: "14px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
              background: "transparent", border: `1px solid ${C.border2}`, color: C.muted,
            }}>← Back</button>
            <button onClick={submit} disabled={submitting} style={{
              flex: 1, padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
              background: "rgba(61,255,61,0.12)", border: `1px solid ${C.green}`,
              color: C.green, opacity: submitting ? 0.6 : 1, transition: "opacity 0.15s",
            }}>
              {submitting ? "Setting up your workspace…" : "Launch My Dashboard →"}
            </button>
          </div>

          <p style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: C.muted }}>
            You can skip adding clients and add them manually later.
          </p>
        </div>
      )}
    </div>
  );
}
