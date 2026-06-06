"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import type { GmailThread } from "@/app/api/gmail/threads/route";

function parseFrom(from: string) {
  const m = from.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  return (m?.[1] || from).trim();
}

function relTime(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h`;
  if (hrs < 48) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function InboxPanel() {
  const { D } = useTheme();
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not_connected" | "error" | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gmail/threads?q=${encodeURIComponent("is:unread in:inbox category:primary")}&maxResults=7`);
      if (res.status === 401) { setError("not_connected"); setLoading(false); return; }
      if (!res.ok) { setError("error"); setLoading(false); return; }
      const data = await res.json();
      setThreads(data.threads || []);
    } catch {
      setError("error");
    }
    setLoading(false);
  }

  return (
    <div style={{ background: D.bg2, border: `1px solid ${D.purple}60`, borderRadius: 12, overflow: "hidden", boxShadow: `0 0 0 1px ${D.purple}15, 0 4px 20px ${D.purple}12` }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${D.purple}25`, background: `linear-gradient(135deg, ${D.purple}22 0%, ${D.purple}10 100%)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>✉️</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: D.purple, textTransform: "uppercase", letterSpacing: "0.08em" }}>Primary Inbox</span>
          {!loading && !error && threads.length > 0 && (
            <span style={{ background: `${D.purple}18`, color: D.purple, border: `1px solid ${D.purple}35`, borderRadius: 9, fontSize: 10, fontWeight: 700, padding: "0 6px", height: 17, display: "inline-flex", alignItems: "center" }}>
              {threads.length} unread
            </span>
          )}
        </div>
        <button onClick={load} disabled={loading} title="Refresh" style={{ background: "none", border: "none", color: loading ? D.hint : D.purple, cursor: loading ? "default" : "pointer", fontSize: 14, opacity: loading ? 0.4 : 0.7, padding: 0, lineHeight: 1 }}>↻</button>
      </div>

      {/* Email rows */}
      {loading && (
        <div style={{ padding: "14px 16px", color: D.hint, fontSize: 12 }}>Loading…</div>
      )}

      {!loading && error === "not_connected" && (
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: D.muted }}>Google account not connected.</span>
          <a href="/api/auth" style={{ fontSize: 12, fontWeight: 600, color: D.purple, textDecoration: "none", border: `1px solid ${D.purple}40`, borderRadius: 6, padding: "3px 10px" }}>Connect →</a>
        </div>
      )}

      {!loading && error === "error" && (
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: D.muted }}>Failed to load.</span>
          <button onClick={load} style={{ background: "none", border: `1px solid ${D.border}`, borderRadius: 5, color: D.muted, cursor: "pointer", padding: "2px 8px", fontSize: 11, fontFamily: "inherit" }}>Retry</button>
        </div>
      )}

      {!loading && !error && threads.length === 0 && (
        <div style={{ padding: "14px 16px", color: D.hint, fontSize: 12 }}>No unread emails in primary inbox.</div>
      )}

      {!loading && !error && threads.map((t, i) => {
        const name = parseFrom(t.from);
        const gmailUrl = `https://mail.google.com/mail/#inbox/${t.id}`;
        return (
          <a
            key={t.id}
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 16px",
              borderTop: i > 0 ? `1px solid ${D.border}` : undefined,
              textDecoration: "none",
              background: "transparent",
              transition: "background 0.1s",
            }}
            className="qcl-row"
          >
            {/* Unread dot */}
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: D.purple, flexShrink: 0, opacity: 0.7 }} />

            {/* Sender */}
            <span style={{ fontSize: 12, fontWeight: 600, color: D.text, flexShrink: 0, width: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </span>

            {/* Subject */}
            <span style={{ fontSize: 12, color: D.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.subject || "(no subject)"}
            </span>

            {/* Time */}
            <span style={{ fontSize: 11, color: D.hint, flexShrink: 0 }}>{relTime(t.date)}</span>
          </a>
        );
      })}
    </div>
  );
}
