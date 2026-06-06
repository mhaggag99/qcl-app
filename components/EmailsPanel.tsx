"use client";
import React, { useState, useEffect } from "react";
import type { Client } from "@/types";
import { useTheme } from "@/lib/theme";
import type { GmailThread } from "@/app/api/gmail/threads/route";
import { inp, B } from "./ui";

function parseFrom(from: string) {
  const m = from.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  return { name: (m?.[1] || from).trim(), email: (m?.[2] || "").trim() };
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function GmailIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
    </svg>
  );
}

function parseDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function ThreadRow({ t, D, clientName, onAddNote }: {
  t: GmailThread;
  D: ReturnType<typeof useTheme>["D"];
  clientName: string;
  onAddNote: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ saved: boolean; text: string } | null>(null);
  const { name } = parseFrom(t.from);
  const snippet = decodeEntities(t.snippet);
  const subject = t.subject && t.subject !== "(no subject)" ? t.subject : "";
  const gmailUrl = `https://mail.google.com/mail/#all/${t.id}`;

  async function analyze() {
    setAnalyzing(true);
    setResult(null);
    try {
      const fetchRes = await fetch("/api/gmail/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadIds: [t.id] }),
      });
      if (!fetchRes.ok) throw new Error();
      const { threads: full } = await fetchRes.json() as {
        threads: { subject: string; messages: { from: string; date: string; body: string }[] }[]
      };

      const emailContent = full.map((th) =>
        `Subject: ${th.subject}\n` + th.messages.map((m) =>
          `From: ${m.from}\nDate: ${m.date}\n${m.body}`
        ).join("\n---\n")
      ).join("\n\n");

      const aiRes = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            model: "claude-sonnet-4-6",
            max_tokens: 500,
            messages: [{ role: "user", content: `You are analyzing an email thread between Marwan (QCL) and the client "${clientName}".

Extract ONLY concrete agreements, commitments, decisions, or action items. Ignore pleasantries and generic content.

If there is nothing concrete, respond with exactly: NO_AGREEMENTS

Otherwise, respond with a concise bullet-point summary (2-5 bullets). Start each bullet with "• ". Be specific — include dates, numbers, names when mentioned.

EMAIL:
${emailContent}` }],
          },
        }),
      });
      const aiData = await aiRes.json();
      const summary = aiData.content?.[0]?.text?.trim() || "";

      if (!summary || summary === "NO_AGREEMENTS") {
        setResult({ saved: false, text: "No concrete agreements found in this email." });
      } else {
        onAddNote(`✦ AI: Email analysis\nSubject: "${subject || "(no subject)"}"\n\n${summary}`);
        setResult({ saved: true, text: summary });
      }
    } catch {
      setResult({ saved: false, text: "Failed to analyze. Please try again." });
    }
    setAnalyzing(false);
  }

  return (
    <div style={{ border: `1px solid ${D.border}`, borderRadius: 8, marginBottom: 7, background: D.bg2, overflow: "hidden" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ padding: "10px 12px", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
      >
        <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: "#fce8e6", border: "1px solid #f5c6c2", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <GmailIcon size={16} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: subject ? D.text : D.hint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {subject || "(no subject)"}
            </span>
            <span style={{ fontSize: 11, color: D.muted, flexShrink: 0 }}>{parseDate(t.date)}</span>
          </div>
          {name && <div style={{ fontSize: 11, color: D.muted, marginBottom: 2 }}>{name}</div>}
          {!open && snippet && (
            <div style={{ fontSize: 12, color: D.hint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {snippet}
            </div>
          )}
        </div>

        {t.messageCount > 1 && (
          <span style={{ fontSize: 10, color: D.muted, background: D.bg3, border: `1px solid ${D.border}`, borderRadius: 8, padding: "1px 6px", flexShrink: 0 }}>
            {t.messageCount}
          </span>
        )}
      </div>

      {open && (
        <div style={{ padding: "10px 12px 12px 52px", borderTop: `1px solid ${D.border}` }}>
          {snippet && (
            <div style={{ fontSize: 12, color: D.text, lineHeight: 1.6, marginBottom: 10 }}>
              {snippet}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <a href={gmailUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: D.blue, textDecoration: "none", fontWeight: 600, border: `1px solid ${D.blue}40`, borderRadius: 6, padding: "3px 10px", display: "inline-block" }}>
              Open in Gmail →
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); analyze(); }}
              disabled={analyzing || result?.saved}
              style={{
                fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                padding: "3px 10px", borderRadius: 6, cursor: analyzing || result?.saved ? "default" : "pointer",
                border: `1px solid ${result?.saved ? D.green : D.purple}40`,
                background: result?.saved ? `${D.green}10` : `${D.purple}10`,
                color: result?.saved ? D.green : analyzing ? D.hint : D.purple,
                transition: "all 0.15s",
              }}
            >
              {result?.saved ? "✓ Saved to notes" : analyzing ? "Analyzing…" : "✦ Analyze & save"}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 7, background: result.saved ? `${D.green}0a` : `${D.amber}0a`, border: `1px solid ${result.saved ? D.green : D.amber}25` }}>
              {result.saved && <div style={{ fontSize: 10, fontWeight: 700, color: D.green, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Saved to notes</div>}
              <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{result.text}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmailsPanel({ c, onAddNote }: {
  c: Client;
  onAddNote: (text: string) => void;
}) {
  const { D } = useTheme();
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [gmailError, setGmailError] = useState<"not_connected" | "no_scope" | "api_disabled" | "error" | null>(null);
  const [gmailErrorDetail, setGmailErrorDetail] = useState("");

  const [showCompose, setShowCompose] = useState(false);
  const [draft, setDraft] = useState({ to: c.email || "", subject: "", body: "" });
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    loadThreads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  async function loadThreads() {
    setLoading(true);
    setGmailError(null);
    setGmailErrorDetail("");
    try {
      const q = c.email
        ? `"${c.name}" OR from:${c.email} OR to:${c.email}`
        : `"${c.name}"`;
      const res = await fetch(`/api/gmail/threads?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.status === 401) { setGmailError("not_connected"); setLoading(false); return; }
      if (res.status === 403) {
        setGmailErrorDetail(data.googleMessage || "");
        setGmailError(data.isApiDisabled ? "api_disabled" : "no_scope");
        setLoading(false); return;
      }
      if (!res.ok) { setGmailErrorDetail(data.googleMessage || ""); setGmailError("error"); setLoading(false); return; }
      setThreads(data.threads || []);
    } catch {
      setGmailError("error");
    }
    setLoading(false);
  }

  async function generateDraft() {
    setAiLoading(true);
    try {
      const prompt = `You are helping draft a professional email for a lead generation client.

Client: ${c.name}
Email: ${c.email || "unknown"}
ERT Date: ${c.ert || "TBD"}
Attendees confirmed: ${c.attendees || 0}/20
Status: ${c.status}
Outreach message template: ${c.message || "none"}
Targeting: ${c.targeting || "none"}

Write a concise, professional follow-up email. Return ONLY a JSON object:
{"subject": "...", "body": "..."}`;

      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            model: "claude-sonnet-4-6",
            max_tokens: 800,
            messages: [{ role: "user", content: prompt }],
          },
        }),
      });
      const data = await res.json();
      const text: string = data.content?.[0]?.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : text);
      setDraft((d) => ({
        ...d,
        to: c.email || "",
        subject: parsed.subject || `Follow-up: ${c.name} ERT`,
        body: parsed.body || text,
      }));
    } catch {
      setDraft((d) => ({
        ...d,
        subject: `Follow-up: ${c.name} ERT`,
        body: "",
      }));
    }
    setAiLoading(false);
  }

  async function saveToDrafts() {
    if (!draft.body.trim()) return;
    setSaving(true); setSaveError("");
    const res = await fetch("/api/gmail/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }).then((r) => r.json());
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setSaveError(res.error || "Failed to save draft");
  }

  async function sendEmail() {
    if (!draft.body.trim()) return;
    setSending(true); setSaveError("");
    const res = await fetch("/api/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }).then((r) => r.json());
    setSending(false);
    if (res.ok) {
      setSent(true);
      setTimeout(() => { setSent(false); setShowCompose(false); setDraft({ to: c.email || "", subject: "", body: "" }); }, 2000);
    } else {
      setSaveError(res.error || "Failed to send");
    }
  }

  function openInGmail() {
    const params = new URLSearchParams({ view: "cm", to: draft.to, su: draft.subject, body: draft.body });
    window.open(`https://mail.google.com/mail/?${params}`, "_blank");
  }

  function logAsNote() {
    if (!draft.body.trim()) return;
    onAddNote(`📧 Email draft — ${draft.subject}\n\n${draft.body}`);
    setShowCompose(false);
  }

  const ta: React.CSSProperties = { ...inp, resize: "vertical", minHeight: 120, padding: "8px 10px", fontSize: 12, lineHeight: 1.5 };

  // ── Error states ──────────────────────────────────────────────────────────
  if (gmailError === "not_connected") return (
    <div style={{ textAlign: "center", padding: "32px 16px" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>📭</div>
      <div style={{ fontSize: 13, color: D.muted, marginBottom: 14, lineHeight: 1.5 }}>
        Google account not connected. Connect to view emails and save drafts.
      </div>
      <a href="/api/auth" style={{ display: "inline-block", background: D.blue, color: "#fff", borderRadius: 7, padding: "7px 18px", fontSize: 12, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>
        Connect Google
      </a>
    </div>
  );

  if (gmailError === "api_disabled") return (
    <div style={{ padding: "20px 8px" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⚙️</div>
        <div style={{ fontSize: 13, color: D.text, fontWeight: 600, marginBottom: 8 }}>Gmail API not enabled</div>
        <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.6, marginBottom: 16 }}>
          The Gmail API needs to be enabled in your Google Cloud project. Follow these steps:
        </div>
      </div>
      <div style={{ background: D.bg3, border: `1px solid ${D.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 12, lineHeight: 1.8, color: D.muted, marginBottom: 14 }}>
        <div style={{ color: D.text, fontWeight: 600, marginBottom: 6 }}>Steps to fix:</div>
        <div>1. Go to <strong style={{ color: D.blue }}>console.cloud.google.com</strong></div>
        <div>2. Select your project → <strong>APIs & Services → Library</strong></div>
        <div>3. Search for <strong>"Gmail API"</strong> and click <strong>Enable</strong></div>
        <div>4. Come back and click <strong>Re-connect</strong> below</div>
      </div>
      {gmailErrorDetail && (
        <div style={{ fontSize: 11, color: D.hint, background: D.bg3, borderRadius: 6, padding: "6px 10px", marginBottom: 12, wordBreak: "break-word" }}>
          Google: {gmailErrorDetail}
        </div>
      )}
      <a href="/api/auth" style={{ display: "block", textAlign: "center", background: D.blue, color: "#fff", borderRadius: 7, padding: "8px 18px", fontSize: 12, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>
        Re-connect after enabling
      </a>
    </div>
  );

  if (gmailError === "no_scope") return (
    <div style={{ padding: "20px 8px" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔓</div>
        <div style={{ fontSize: 13, color: D.text, fontWeight: 600, marginBottom: 8 }}>Gmail permission missing</div>
        <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.6, marginBottom: 16 }}>
          Your Google account is connected but Gmail access wasn&apos;t granted. This can happen if you unchecked Gmail during sign-in, or if it&apos;s blocked by your Google Workspace admin.
        </div>
      </div>
      {gmailErrorDetail && (
        <div style={{ fontSize: 11, color: D.hint, background: D.bg3, borderRadius: 6, padding: "6px 10px", marginBottom: 12, wordBreak: "break-word" }}>
          Google: {gmailErrorDetail}
        </div>
      )}
      <a href="/api/auth" style={{ display: "block", textAlign: "center", background: D.blue, color: "#fff", borderRadius: 7, padding: "8px 18px", fontSize: 12, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>
        Re-connect &amp; allow Gmail
      </a>
    </div>
  );

  if (gmailError === "error") return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: D.muted, fontSize: 13 }}>
      Failed to load emails.
      {gmailErrorDetail && <div style={{ fontSize: 11, color: D.hint, marginTop: 6 }}>{gmailErrorDetail}</div>}
      <br />
      <button onClick={loadThreads} style={{ marginTop: 10, background: "none", border: `1px solid ${D.border}`, borderRadius: 6, color: D.muted, cursor: "pointer", padding: "5px 14px", fontSize: 12, fontFamily: "inherit" }}>Retry</button>
    </div>
  );

  return (
    <div>
      {/* Compose section */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showCompose ? 10 : 0 }}>
          <span style={{ fontSize: 11, color: D.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Compose
          </span>
          <button
            onClick={() => { setShowCompose((v) => !v); if (!showCompose) setDraft({ to: c.email || "", subject: "", body: "" }); }}
            style={{ background: showCompose ? D.bg3 : D.blue, color: showCompose ? D.muted : "#fff", border: `1px solid ${showCompose ? D.border : "transparent"}`, borderRadius: 7, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            {showCompose ? "Cancel" : "+ New email"}
          </button>
        </div>

        {showCompose && (
          <div style={{ background: D.bg3, border: `1px solid ${D.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              style={{ ...inp, height: 32, padding: "0 9px", fontSize: 12 }}
              placeholder="To"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
            <input
              style={{ ...inp, height: 32, padding: "0 9px", fontSize: 12 }}
              placeholder="Subject"
              value={draft.subject}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            />
            <textarea
              style={ta}
              placeholder="Email body..."
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            />
            {saveError && <div style={{ fontSize: 11, color: D.red }}>{saveError}</div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={generateDraft}
                disabled={aiLoading}
                style={{
                  background: aiLoading ? D.bg3 : `${D.purple}20`,
                  border: `1px solid ${D.purple}40`,
                  color: aiLoading ? D.hint : D.purple,
                  borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 600,
                  cursor: aiLoading ? "default" : "pointer", fontFamily: "inherit",
                }}
              >
                {aiLoading ? "Generating…" : "✦ Generate with AI"}
              </button>
              <button
                onClick={saveToDrafts}
                disabled={saving || sending || !draft.body.trim()}
                style={{
                  background: saved ? `${D.green}20` : D.bg2,
                  border: `1px solid ${saved ? D.green : D.border}`,
                  color: saved ? D.green : D.muted,
                  borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 600,
                  cursor: !draft.body.trim() ? "default" : "pointer", fontFamily: "inherit",
                  opacity: !draft.body.trim() ? 0.5 : 1,
                }}
              >
                {saved ? "✓ Saved to Drafts" : saving ? "Saving…" : "Save to Drafts"}
              </button>
              <button
                onClick={sendEmail}
                disabled={sending || saving || !draft.body.trim()}
                style={{
                  background: sent ? `${D.green}20` : (!draft.body.trim() ? D.bg3 : D.green),
                  border: `1px solid ${sent ? D.green : "transparent"}`,
                  color: sent ? D.green : (!draft.body.trim() ? D.hint : "#000"),
                  borderRadius: 7, padding: "5px 14px", fontSize: 11, fontWeight: 700,
                  cursor: !draft.body.trim() ? "default" : "pointer", fontFamily: "inherit",
                  opacity: !draft.body.trim() ? 0.4 : 1,
                  boxShadow: draft.body.trim() && !sent ? `0 0 12px ${D.green}40` : "none",
                }}
              >
                {sent ? "✓ Sent!" : sending ? "Sending…" : "Send ↑"}
              </button>
              <button
                onClick={openInGmail}
                style={{
                  background: D.bg2, border: `1px solid ${D.border}`,
                  color: D.muted, borderRadius: 7, padding: "5px 12px",
                  fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Open in Gmail ↗
              </button>
              <button
                onClick={logAsNote}
                disabled={!draft.body.trim()}
                style={{
                  background: D.bg2, border: `1px solid ${D.border}`,
                  color: D.muted, borderRadius: 7, padding: "5px 12px",
                  fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  opacity: !draft.body.trim() ? 0.5 : 1,
                }}
              >
                Log as note
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Thread list */}
      <div style={{ fontSize: 11, color: D.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        Recent threads
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "24px 16px", color: D.hint, fontSize: 12 }}>Searching Gmail…</div>
      )}

      {!loading && threads.length === 0 && (
        <div style={{ textAlign: "center", padding: "24px 16px", color: D.hint, fontSize: 12 }}>
          No email threads found for {c.name}.
        </div>
      )}

      {threads.map((t) => (
        <ThreadRow key={t.id} t={t} D={D} clientName={c.name} onAddNote={onAddNote} />
      ))}
    </div>
  );
}
