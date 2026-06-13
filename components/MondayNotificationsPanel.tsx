"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme";

interface MondayNotification {
  id: string;
  text: string;
  created_at: string;
  creator: string;
}

function MondayLogo({ size = 20 }: { size?: number }) {
  // Monday.com brand: 3 colored circles
  const r = size * 0.18;
  const cy = size / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="4" cy="10" r="3.2" fill="#FF3D57" />
      <circle cx="10" cy="10" r="3.2" fill="#FFCB00" />
      <circle cx="16" cy="10" r="3.2" fill="#00CA72" />
    </svg>
  );
}

export default function MondayNotificationsPanel() {
  const { D } = useTheme();
  const accent = "#FF3D57"; // Monday red

  const [notifications, setNotifications] = useState<MondayNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/monday/mentions");
      const data = await res.json();
      if (data?.error) { setError(data.error); setNotifications([]); }
      else setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e));
      setNotifications([]);
    }
    setLoading(false);
  }

  async function act(id: string, text: string, addAsTask: boolean) {
    setActioning(id);
    await fetch("/api/monday/mentions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id, text, addAsTask }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (addAsTask) window.dispatchEvent(new Event("task-refresh"));
    setActioning(null);
  }

  function fmtDate(s: string) {
    if (!s) return "";
    try {
      return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return s; }
  }

  const th: React.CSSProperties = {
    fontSize: 11, color: D.muted, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.05em", padding: "8px 14px", textAlign: "left",
    borderBottom: `1px solid ${D.border}`, background: D.bg3,
  };

  return (
    <div style={{
      background: D.bg2,
      border: `1px solid ${accent}50`,
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: `0 0 0 1px ${accent}12, 0 4px 20px ${accent}10`,
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 14px",
        borderBottom: `1px solid ${accent}25`,
        background: `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MondayLogo size={18} />
          <span style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Monday Notifications
          </span>
          {notifications.length > 0 && (
            <span style={{
              background: accent, color: "#fff", borderRadius: 9,
              fontSize: 10, fontWeight: 700, padding: "0 6px", height: 17,
              display: "inline-flex", alignItems: "center",
            }}>
              {notifications.length}
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            fontSize: 10, background: "none", border: `1px solid ${D.border}`,
            borderRadius: 5, color: D.muted, cursor: "pointer",
            padding: "2px 8px", fontFamily: "inherit",
          }}
        >
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {/* Body */}
      {loading && (
        <div style={{ padding: "24px 16px", color: D.hint, fontSize: 12, textAlign: "center" }}>
          Fetching from Monday…
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: "16px", color: D.red, fontSize: 12 }}>
          Could not load: {error}
        </div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div style={{ padding: "24px 16px", color: D.hint, fontSize: 13, textAlign: "center" }}>
          No unread notifications.
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {notifications.map((n, i) => (
            <div
              key={n.id}
              style={{
                padding: "11px 14px",
                borderTop: i > 0 ? `1px solid ${D.border}` : undefined,
                display: "flex", flexDirection: "column", gap: 7,
                background: D.bg2,
              }}
            >
              <span style={{ fontSize: 12.5, color: D.text, lineHeight: 1.45 }}>{n.text}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: D.muted, flex: 1 }}>
                  {n.creator && <strong>{n.creator} · </strong>}{fmtDate(n.created_at)}
                </span>
                <button
                  onClick={() => act(n.id, n.text, true)}
                  disabled={actioning === n.id}
                  style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 5,
                    background: accent, color: "#fff", border: "none",
                    cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                    opacity: actioning === n.id ? 0.5 : 1,
                  }}
                >
                  + Add as task
                </button>
                <button
                  onClick={() => act(n.id, n.text, false)}
                  disabled={actioning === n.id}
                  style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 5,
                    background: "none", color: D.muted, border: `1px solid ${D.border}`,
                    cursor: "pointer", fontFamily: "inherit",
                    opacity: actioning === n.id ? 0.5 : 1,
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
