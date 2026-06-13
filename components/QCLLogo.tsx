"use client";
import React from "react";

export const BRAND_GREEN = "#3DFF3D";

// ─── Q Ring mark ─────────────────────────────────────────────────────────────
// Matches the actual logo exactly:
//   • thick green ring (border), NOT a filled circle
//   • black interior
//   • white $ inside
//   • rounded-tip tail at bottom-right, angled ~40° (magnifying-glass / Q letterform)

function QRing({ size }: { size: number }) {
  const stroke  = Math.round(size * 0.165); // ring stroke thickness
  const tailW   = Math.round(stroke * 0.95);
  const tailH   = Math.round(size * 0.42);
  const dollarSize = Math.round(size * 0.40);

  return (
    <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
      {/* Green ring with black interior */}
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "#111",
        border: `${stroke}px solid ${BRAND_GREEN}`,
        boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* White $ */}
        <span style={{
          fontSize: dollarSize,
          fontWeight: 900,
          color: "#ffffff",
          fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
          lineHeight: 1,
          userSelect: "none",
          display: "block",
          transform: "translateY(-1px)",
        }}>$</span>
      </div>

      {/* Tail — rounded rect, positioned at bottom-right, angled to match the Q letterform */}
      <div style={{
        position: "absolute",
        bottom: -Math.round(tailH * 0.50),
        right:  Math.round(size * 0.06),
        width:  tailW,
        height: tailH,
        borderRadius: Math.round(tailW / 2),
        background: BRAND_GREEN,
        transform: "rotate(42deg)",
        transformOrigin: "top center",
      }} />
    </div>
  );
}

// ─── Compact: Q ring + "CL" ──────────────────────────────────────────────────
// Used in desktop header, mobile header, admin header.
// dark=true  → green "CL" (matches logo on dark bg)
// dark=false → dark "CL" (readable on light bg)

export function QCLCompact({ height = 32, dark = true }: { height?: number; dark?: boolean }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center",
      gap: Math.round(height * 0.13),
      userSelect: "none", flexShrink: 0,
    }}>
      <QRing size={height} />
      <span style={{
        fontSize: Math.round(height * 0.90),
        fontWeight: 900,
        color: dark ? BRAND_GREEN : "#111111",
        fontFamily: "'Arial Black', 'Helvetica Neue', Impact, Arial, sans-serif",
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}>CL</span>
    </div>
  );
}

// ─── Full: Q ring + "CL" + "LEADS" ──────────────────────────────────────────
// Used on the login page (always dark bg).

export function QCLFull({ height = 60, dark = true }: { height?: number; dark?: boolean }) {
  const markSize = Math.round(height * 0.68);
  const clSize   = Math.round(markSize * 0.96);
  const subSize  = Math.max(9, Math.round(markSize * 0.19));

  return (
    <div style={{
      display: "inline-flex", alignItems: "center",
      gap: Math.round(height * 0.11),
      userSelect: "none", flexShrink: 0,
    }}>
      <QRing size={markSize} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{
          fontSize: clSize,
          fontWeight: 900,
          color: dark ? BRAND_GREEN : "#111111",
          fontFamily: "'Arial Black', 'Helvetica Neue', Impact, Arial, sans-serif",
          lineHeight: 0.92,
          letterSpacing: "-0.02em",
        }}>CL</span>
        <span style={{
          fontSize: subSize,
          fontWeight: 700,
          color: dark ? "rgba(255,255,255,0.50)" : "#888",
          letterSpacing: "0.44em",
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          marginTop: 5,
          paddingLeft: 1,
        }}>LEADS</span>
      </div>
    </div>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────
// Always on dark bg. Green ring traces itself, then Q mark pops in, then text fades up.

export function QCLLoadingScreen() {
  const ringR = 60;
  const circ  = +(2 * Math.PI * ringR).toFixed(2);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", minHeight: "100vh",
      background: "#060810",
    }}>
      <style>{`
        @keyframes qcl-ring {
          0%   { stroke-dashoffset: ${circ}; opacity: 1; }
          65%  { stroke-dashoffset: 0;       opacity: 1; }
          100% { stroke-dashoffset: 0;       opacity: 0.3; }
        }
        @keyframes qcl-glow {
          0%   { stroke-dashoffset: ${circ}; opacity: 0; }
          20%  { opacity: 0.18; }
          65%  { stroke-dashoffset: 0; opacity: 0.18; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes qcl-pop {
          0%   { opacity: 0; transform: scale(0.65); }
          40%  { opacity: 1; transform: scale(1.10); }
          60%  { transform: scale(0.96); }
          78%  { transform: scale(1.02); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes qcl-text-up {
          0%, 50% { opacity: 0; transform: translateY(12px); }
          85%     { opacity: 1; transform: translateY(0);    }
          100%    { opacity: 1; transform: translateY(0);    }
        }
        @keyframes qcl-dot {
          0%, 80%, 100% { opacity: 0.12; transform: scale(0.6); }
          40%           { opacity: 1;    transform: scale(1);   }
        }
      `}</style>

      {/* Ring + Q mark */}
      <div style={{
        position: "relative", width: 150, height: 150,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg
          width="150" height="150" viewBox="0 0 150 150" fill="none"
          style={{ position: "absolute", inset: 0 }}
        >
          {/* Glow layer */}
          <circle
            cx="75" cy="75" r={ringR}
            stroke={BRAND_GREEN} strokeWidth="12" fill="none"
            strokeDasharray={`${circ} ${circ}`}
            style={{
              animation: `qcl-glow 2.2s cubic-bezier(0.4,0,0.2,1) forwards`,
              transform: "rotate(-90deg)", transformOrigin: "center",
              filter: "blur(6px)",
            }}
          />
          {/* Crisp ring */}
          <circle
            cx="75" cy="75" r={ringR}
            stroke={BRAND_GREEN} strokeWidth="2" strokeLinecap="round" fill="none"
            strokeDasharray={`${circ} ${circ}`}
            style={{
              animation: `qcl-ring 2.2s cubic-bezier(0.4,0,0.2,1) forwards`,
              transform: "rotate(-90deg)", transformOrigin: "center",
            }}
          />
        </svg>

        {/* Q mark springs in */}
        <div style={{ animation: "qcl-pop 0.75s cubic-bezier(0.34,1.56,0.64,1) 0.3s both" }}>
          <QRing size={82} />
        </div>
      </div>

      {/* Brand text fades up */}
      <div style={{
        marginTop: 28,
        animation: "qcl-text-up 2.4s ease both",
        textAlign: "center",
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "center", gap: 1,
        }}>
          <span style={{
            fontSize: 22, fontWeight: 900, color: BRAND_GREEN,
            fontFamily: "'Arial Black', 'Helvetica Neue', sans-serif",
            letterSpacing: "-0.02em",
          }}>QCL</span>
          <span style={{ fontSize: 22, color: "rgba(255,255,255,0.25)", fontWeight: 900 }}>.</span>
        </div>
        <div style={{
          fontSize: 9, color: "#3a5070", letterSpacing: "0.48em",
          fontFamily: "monospace", marginTop: 6,
        }}>LEADS</div>
      </div>

      {/* Pulsing dots */}
      <div style={{ display: "flex", gap: 7, marginTop: 24 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: "50%",
            background: BRAND_GREEN,
            animation: `qcl-dot 1.4s ease-in-out ${i * 0.18}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}
