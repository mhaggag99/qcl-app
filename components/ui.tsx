"use client";
import React from "react";
import { useTheme } from "@/lib/theme";

export const inp: React.CSSProperties = {
  borderRadius: 8, border: "1px solid var(--qcl-border)", background: "var(--qcl-bg3)",
  color: "var(--qcl-text)", fontSize: 13, padding: "7px 10px", fontFamily: "inherit",
  width: "100%", outline: "none",
};
export const tex: React.CSSProperties = {
  ...inp, resize: "vertical" as const, minHeight: 76, lineHeight: 1.5, display: "block",
};

export function B({ children, onClick, primary, sm, danger, style = {} }: {
  children: React.ReactNode; onClick?: () => void; primary?: boolean;
  sm?: boolean; danger?: boolean; style?: React.CSSProperties;
}) {
  const { D } = useTheme();
  return (
    <button onClick={onClick} className={`qcl-btn${primary ? " qcl-btn-primary" : ""}`} style={{
      padding: sm ? "5px 11px" : "7px 15px",
      borderRadius: 8,
      border: `1px solid ${danger ? D.red : primary ? "transparent" : D.border2}`,
      background: primary ? D.text : danger ? "transparent" : D.bg3,
      color: primary ? D.bg : danger ? D.red : D.text,
      fontSize: sm ? 12 : 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
      display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
      letterSpacing: "0.01em", ...style,
    }}>{children}</button>
  );
}

export function IB({ children, onClick, danger, title }: {
  children: React.ReactNode; onClick?: () => void; danger?: boolean; title?: string;
}) {
  const { D } = useTheme();
  return (
    <button title={title} onClick={onClick} className={`qcl-ib${danger ? " qcl-ib-danger" : ""}`} style={{
      width: 30, height: 30, borderRadius: 8,
      border: "none",
      background: "transparent",
      color: danger ? D.red : D.muted,
      opacity: 0.5,
      cursor: "pointer", display: "inline-flex", alignItems: "center",
      justifyContent: "center", fontSize: 15, flexShrink: 0,
    }}>{children}</button>
  );
}

export function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  const { D } = useTheme();
  const m: Record<string, { bg: string; c: string }> = {
    green:  { bg: `${D.green}1a`,  c: D.green  },
    red:    { bg: `${D.red}1a`,    c: D.red    },
    amber:  { bg: `${D.amber}1a`,  c: D.amber  },
    blue:   { bg: `${D.blue}1a`,   c: D.blue   },
    gray:   { bg: "rgba(128,128,128,0.1)", c: "rgba(110,110,110,0.85)" },
    purple: { bg: `${D.purple}1a`, c: D.purple },
  };
  const k = m[color] || m.gray;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
      letterSpacing: "0.02em",
      background: k.bg, color: k.c,
    }}>{children}</span>
  );
}

export function VaChip({ va }: { va?: string }) {
  const { D } = useTheme();
  if (!va) return <span style={{ color: D.muted }}>—</span>;
  const m: Record<string, { bg: string; c: string }> = {
    Janine:    { bg: `${D.red}1e`,    c: D.red },
    Meliza:    { bg: `${D.purple}1e`, c: D.purple },
    Charlene:  { bg: `${D.amber}1e`,  c: D.amber },
    Markjones: { bg: `${D.blue}1e`,   c: D.blue },
  };
  const k = m[va] || { bg: D.bg3, c: D.muted };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 12, fontSize: 11, fontWeight: 600,
      letterSpacing: "0.02em",
      background: k.bg, color: k.c,
    }}>{va}</span>
  );
}

export function SPill({ s }: { s?: string }) {
  const m: Record<string, string> = {
    Performing: "green", "Slow Generating": "amber", "At Risk": "red",
    "New Client": "blue", Stopped: "gray",
  };
  return <Pill color={m[s || ""] || "gray"}>{s || "—"}</Pill>;
}

export function Prog({ val }: { val: number }) {
  const { D } = useTheme();
  const pct = Math.min(100, Math.round(((val || 0) / 20) * 100));
  const c = pct >= 100 ? D.green : pct >= 60 ? D.amber : D.red;
  const glow = pct >= 100 ? `0 0 8px ${D.green}60` : "none";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{ background: D.bg2, borderRadius: 5, height: 7, width: 80, overflow: "hidden", border: `1px solid ${D.border}` }}>
        <div className="qcl-prog-bar" style={{ height: "100%", borderRadius: 5, background: c, width: pct + "%", boxShadow: glow }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: pct >= 100 ? D.green : D.text, fontVariantNumeric: "tabular-nums" }}>{val || 0}/20</span>
    </div>
  );
}

export function Days({ ert }: { ert?: string }) {
  const { D } = useTheme();
  const d = (() => {
    if (!ert) return null;
    const t = new Date(ert + "T00:00:00");
    const n = new Date(); n.setHours(0, 0, 0, 0);
    return Math.round((t.getTime() - n.getTime()) / 864e5);
  })();
  if (d === null) return <span style={{ color: D.muted }}>—</span>;
  const c = d <= 7 ? D.red : d <= 14 ? D.amber : D.green;
  return <span style={{ color: c, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{d}d</span>;
}

export function LiPill({ li }: { li?: string }) {
  if (li === "Active") return <Pill color="green">Active</Pill>;
  if (li === "Inactive") return <Pill color="amber">Inactive</Pill>;
  if (li === "Not Eligible") return <Pill color="gray">Not eligible</Pill>;
  const { D } = useTheme();
  return <span style={{ color: D.muted }}>—</span>;
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; wide?: boolean;
}) {
  const { D } = useTheme();
  if (!open) return null;
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(4,7,18,0.85)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "36px 12px", overflowY: "auto",
    }}>
      <div className="qcl-modal-content" style={{
        background: D.bg2,
        border: `1px solid ${D.border2}`,
        borderRadius: 14,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(75,163,255,0.06)",
        width: wide ? 640 : 560, maxWidth: "98vw", padding: 24, marginBottom: 36,
      }}>
        <div style={{
          fontSize: 15, fontWeight: 600, marginBottom: 18,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          letterSpacing: "-0.01em",
        }}>
          {title}<IB onClick={onClose}>✕</IB>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}

export function FL({ label, full, children }: {
  label: string; full?: boolean; children: React.ReactNode;
}) {
  const { D } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: full ? "1 / -1" : "auto" }}>
      <label style={{ fontSize: 11, color: D.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function MA({ children }: { children: React.ReactNode }) {
  const { D } = useTheme();
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${D.border}` }}>
      {children}
    </div>
  );
}
