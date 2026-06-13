"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme";

interface Props {
  onClose: () => void;
  userName: string;
}

export default function UserSettingsModal({ onClose, userName }: Props) {
  const { D } = useTheme();
  const [mondayToken, setMondayToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(true);
  const hasGoogleEnv = !!process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED;

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        setGoogleConnected(d.googleConnected ?? false);
        setGoogleLoading(false);
      })
      .catch(() => setGoogleLoading(false));
  }, []);

  async function saveMondayToken() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mondayApiToken: mondayToken }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setMondayToken("");
  }

  async function revokeGoogle() {
    await fetch("/api/auth/revoke", { method: "POST" });
    setGoogleConnected(false);
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999,
  };

  const modal: React.CSSProperties = {
    background: D.bg3,
    border: `1px solid ${D.border}`,
    borderRadius: 16,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 460,
    fontFamily: "'Inter', sans-serif",
  };

  const label: React.CSSProperties = {
    display: "block",
    color: "rgba(216,227,245,0.6)",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    marginBottom: 6,
  };

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    background: D.bg,
    border: `1px solid ${D.border}`,
    borderRadius: 8,
    color: D.text,
    fontSize: 13,
    outline: "none",
  };

  const sectionTitle: React.CSSProperties = {
    color: D.text,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: `1px solid ${D.border}`,
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal} className="qcl-modal-content">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ color: D.text, fontSize: 16, fontWeight: 700 }}>Settings</div>
            <div style={{ color: D.muted, fontSize: 12, marginTop: 2 }}>{userName}</div>
          </div>
          <button
            onClick={onClose}
            className="qcl-ib"
            style={{ background: "none", border: "none", color: D.muted, fontSize: 20, cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}
          >×</button>
        </div>

        {/* Monday Section */}
        <div style={{ marginBottom: 28 }}>
          <div style={sectionTitle}>Monday.com</div>
          <label style={label}>API Token</label>
          <input
            type="password"
            value={mondayToken}
            onChange={(e) => setMondayToken(e.target.value)}
            placeholder="Paste your Monday API token…"
            className="qcl-inp"
            style={inp}
          />
          <div style={{ color: D.muted, fontSize: 11, marginTop: 6, marginBottom: 12 }}>
            Found in Monday.com → Profile → Admin → API. Leave blank to keep current token.
          </div>
          <button
            onClick={saveMondayToken}
            disabled={saving || !mondayToken.trim()}
            className="qcl-btn"
            style={{
              padding: "8px 18px",
              background: saved ? "rgba(56,239,125,0.15)" : "rgba(75,163,255,0.15)",
              border: `1px solid ${saved ? "rgba(56,239,125,0.3)" : "rgba(75,163,255,0.3)"}`,
              borderRadius: 7,
              color: saved ? "#38ef7d" : "#4ba3ff",
              fontSize: 13,
              fontWeight: 500,
              cursor: saving || !mondayToken.trim() ? "not-allowed" : "pointer",
              opacity: !mondayToken.trim() ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Token"}
          </button>
        </div>

        {/* Google Section */}
        {process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED !== "false" && (
          <div>
            <div style={sectionTitle}>Google Account</div>
            {googleLoading ? (
              <div style={{ color: D.muted, fontSize: 13 }}>Checking…</div>
            ) : googleConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "#38ef7d", fontSize: 13 }}>✓ Connected</span>
                <button
                  onClick={revokeGoogle}
                  className="qcl-btn"
                  style={{
                    padding: "6px 14px",
                    background: "rgba(255,77,106,0.1)",
                    border: "1px solid rgba(255,77,106,0.25)",
                    borderRadius: 6,
                    color: "#ff4d6a",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >Disconnect</button>
              </div>
            ) : (
              <div>
                <div style={{ color: D.muted, fontSize: 12, marginBottom: 12 }}>
                  Connect your Google account to use Calendar and Gmail features.
                </div>
                <a
                  href="/api/auth"
                  className="qcl-btn"
                  style={{
                    display: "inline-block",
                    padding: "8px 18px",
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${D.border2}`,
                    borderRadius: 7,
                    color: D.text,
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                >Connect Google</a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
