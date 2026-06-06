"use client";
import React, { useState, useRef, useEffect } from "react";
import type { Client } from "@/types";
import { VAS } from "@/lib/constants";
import { useTheme } from "@/lib/theme";
import { fmt, tsNow, fuzzyMatch } from "@/lib/utils";
import { B } from "./ui";

function parseCommand(text: string, clients: Client[]) {
  const t = text.trim();
  const lower = t.toLowerCase();

  function findClient(str: string): Client | null {
    const s = str.toLowerCase();
    let best: Client | null = null, bestScore = 0;
    for (const c of clients) {
      const cn = c.name.toLowerCase();
      if (cn === s) return c;
      const parts = cn.split(" ");
      for (const p of parts) {
        if (s.includes(p) || p.includes(s.split(" ")[0])) {
          const sc = Math.min(p.length, s.length) / Math.max(p.length, s.length);
          if (sc > bestScore) { bestScore = sc; best = c; }
        }
      }
      if (cn.includes(s.split(" ")[0]) || s.includes(cn.split(" ")[0])) {
        if (0.6 > bestScore) { bestScore = 0.6; best = c; }
      }
    }
    return bestScore > 0.35 ? best : null;
  }

  function extractDate(str: string): string | null {
    const s = str.toLowerCase();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekdays = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];

    const wd = weekdays.findIndex(w => s.includes("next " + w) || (s.includes(w) && s.includes("next")));
    if (wd !== -1) { const d = new Date(today); const diff = (wd - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10); }

    const inDays = s.match(/in (\d+) day/); if (inDays) { const d = new Date(today); d.setDate(d.getDate() + parseInt(inDays[1])); return d.toISOString().slice(0, 10); }
    const inWeeks = s.match(/in (\d+) week/); if (inWeeks) { const d = new Date(today); d.setDate(d.getDate() + parseInt(inWeeks[1]) * 7); return d.toISOString().slice(0, 10); }
    if (/next week/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }

    for (let mi = 0; mi < months.length; mi++) {
      const mo = months[mi];
      const m1 = s.match(new RegExp(mo + "\\s+(\\d{1,2})"));
      const m2 = s.match(new RegExp("(\\d{1,2})\\s+" + mo));
      const match = m1 || m2;
      if (match) { const day = parseInt(match[1]); const yr = today.getFullYear(); const d = new Date(yr, mi, day); if (d < today) d.setFullYear(yr + 1); return d.toISOString().slice(0, 10); }
    }

    const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (iso) return iso[0];
    const dmy = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (dmy) { const yr = dmy[3] ? (dmy[3].length === 2 ? "20" + dmy[3] : dmy[3]) : today.getFullYear(); return `${yr}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`; }
    return null;
  }

  if (/show.*attention|needs attention|at.?risk|flagged/i.test(lower)) return { action: "nav", tab: "attention", reply: "Showing accounts that need attention." };
  if (/show.*va|va tracker|attendance/i.test(lower)) return { action: "nav", tab: "vas", reply: "Opening VA tracker." };
  if (/show.*overview|go.*home|dashboard/i.test(lower)) return { action: "nav", tab: "overview", reply: "Showing overview." };
  if (/show.*client|all client/i.test(lower)) return { action: "nav", tab: "clients", reply: "Showing all clients." };

  const attMatch = lower.match(/(\d+)\s*(?:attendee|confirmed|registered|people|leads)/);
  if (attMatch) {
    const num = parseInt(attMatch[1]);
    const client = findClient(t);
    if (client) return { action: "update", client, fields: { attendees: num }, reply: `Updated ${client.name} to ${num} attendees confirmed.` };
  }

  if (/reschedul|postpone|ert.*date|new.*ert|ert.*moved|ert.*next|meeting.*date|roundtable.*date/i.test(lower)) {
    const client = findClient(t); const date = extractDate(t);
    if (client && date) return { action: "update", client, fields: { ert: date }, reply: `ERT for ${client.name} updated to ${fmt(date)}.` };
    if (client) return { action: "open", client, reply: `Opened ${client.name} — please set the new ERT date manually.` };
  }

  const statusMap = [
    { patterns: /at.?risk|not working|struggling|no leads|poor/i, status: "At Risk" },
    { patterns: /performing|going well|great|on track|doing well/i, status: "Performing" },
    { patterns: /slow|slow.?generat/i, status: "Slow Generating" },
    { patterns: /stopped|paused|cancel|on hold/i, status: "Stopped" },
    { patterns: /new client/i, status: "New Client" },
  ];
  for (const { patterns, status } of statusMap) {
    if (patterns.test(lower)) {
      const client = findClient(t);
      if (client) return { action: "update", client, fields: { status }, reply: `${client.name} status updated to "${status}".` };
    }
  }

  if (/wants? to meet|scheduled.*call|follow.?up|catch up|meeting|call.*tomorrow|zoom.*call|discuss/i.test(lower)) {
    const client = findClient(t); const date = extractDate(t);
    if (client) {
      const noteText = date ? `${t} (${fmt(date)})` : t;
      return { action: "note", client, noteText, popup: { title: `📅 Meeting noted — ${client.name}`, body: noteText }, reply: `Meeting logged for ${client.name}.${date ? " Date: " + fmt(date) : ""}` };
    }
  }

  if (/flag|red.?zone|issue|problem|block|waiting|hold/i.test(lower)) {
    const client = findClient(t);
    if (client) {
      const flagText = t.replace(new RegExp(client.name, "gi"), "").replace(/flag|red.?zone/gi, "").replace(/^\W+|\W+$/g, "").trim() || t;
      return { action: "update", client, fields: { flag: flagText }, reply: `Flag set on ${client.name}: "${flagText}"` };
    }
  }

  if (/note|log|update|mention|said|told|emailed|called/i.test(lower)) {
    const client = findClient(t);
    const noteText = t.replace(/^(note|log|update|add note)[\s:]+/i, "").trim() || t;
    if (client) return { action: "note", client, noteText, reply: `Note logged for ${client.name}.` };
  }

  if (/open|view|check|show|pull up|look at|go to/i.test(lower)) {
    const client = findClient(t);
    if (client) return { action: "open", client, reply: `Opened ${client.name}.` };
  }

  const client = findClient(t);
  if (client) return { action: "open", client, reply: `Opened ${client.name}.` };

  return { action: "unknown", reply: `I didn't catch that. Try: "Dina 15 attendees", "Mark Greg as at risk", "Peter wants to meet next Monday", or just type a client name.` };
}

function DraftCard({ draft }: { draft: { to: string; subject: string; body: string } }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const done = saved || sent;

  async function saveToDrafts() {
    setSaving(true); setActionErr("");
    const res = await fetch("/api/gmail/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }).then((r) => r.json());
    setSaving(false);
    if (res.ok) setSaved(true);
    else setActionErr(res.error || "Failed to save");
  }

  async function sendEmail() {
    setSending(true); setActionErr("");
    const res = await fetch("/api/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }).then((r) => r.json());
    setSending(false);
    if (res.ok) setSent(true);
    else setActionErr(res.error || "Failed to send");
  }

  function openInGmail() {
    const p = new URLSearchParams({ view: "cm", to: draft.to, su: draft.subject, body: draft.body });
    window.open(`https://mail.google.com/mail/?${p}`, "_blank");
  }

  return (
    <div style={{
      background: "rgba(0,210,180,0.04)", border: "1px solid rgba(0,210,180,0.2)",
      borderRadius: 10, padding: "12px 14px", fontSize: 12,
    }}>
      <div style={{ fontSize: 10, color: "rgba(0,210,180,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>✉ Email Draft</div>
      {draft.to && <div style={{ color: "rgba(216,240,250,0.5)", marginBottom: 4 }}><span style={{ color: "rgba(0,210,180,0.5)" }}>To: </span>{draft.to}</div>}
      <div style={{ color: "rgba(216,240,250,0.8)", fontWeight: 600, marginBottom: 8 }}>{draft.subject}</div>
      <div style={{ color: "rgba(216,240,250,0.65)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 140, overflowY: "auto", marginBottom: 10 }}>{draft.body}</div>
      {actionErr && <div style={{ color: "#f87171", fontSize: 11, marginBottom: 6 }}>{actionErr}</div>}
      {done
        ? <div style={{ fontSize: 12, color: sent ? "#00d2b4" : "rgba(0,210,180,0.7)", fontWeight: 600 }}>
            {sent ? "✓ Email sent" : "✓ Saved to Drafts"}
          </div>
        : <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={saveToDrafts} disabled={saving || sending} style={{
              background: "rgba(0,210,180,0.1)", border: "1px solid rgba(0,210,180,0.25)",
              color: "rgba(0,210,180,0.7)", borderRadius: 7, padding: "4px 11px",
              fontSize: 11, fontWeight: 600, cursor: saving ? "default" : "pointer", fontFamily: "inherit",
              opacity: saving ? 0.6 : 1,
            }}>
              {saving ? "Saving…" : "Save to Drafts"}
            </button>
            <button onClick={sendEmail} disabled={sending || saving} style={{
              background: sending ? "rgba(0,210,180,0.1)" : "linear-gradient(135deg, #00d2b4, #38bdf8)",
              border: "none", color: sending ? "rgba(0,210,180,0.6)" : "#fff",
              borderRadius: 7, padding: "4px 14px", fontSize: 11, fontWeight: 700,
              cursor: sending ? "default" : "pointer", fontFamily: "inherit",
              boxShadow: sending ? "none" : "0 0 14px rgba(0,210,180,0.35)",
            }}>
              {sending ? "Sending…" : "Send ↑"}
            </button>
            <button onClick={openInGmail} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(216,240,250,0.5)", borderRadius: 7, padding: "4px 11px",
              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              Open in Gmail ↗
            </button>
          </div>
      }
    </div>
  );
}

type QuickBarProps = {
  clients: Client[];
  onAction: (a: { type: string; clientId: string; fields?: Record<string, unknown>; noteText?: string; noteTitle?: string; aiTagged?: boolean }) => void;
  setModal: (m: { type: string; id?: string } | null) => void;
  setTab: (t: string) => void;
};

export default function QuickBar({ clients, onAction, setModal, setTab }: QuickBarProps) {
  const { D } = useTheme();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ role: string; text: string; raw?: string; ts: string; clientName?: string; draft?: { to: string; subject: string; body: string } }[]>([]);
  const [notification, setNotification] = useState<{ title: string; body: string; clientId: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "kb">("chat");
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [kb, setKb] = useState("");
  const [kbDraft, setKbDraft] = useState("");
  const [kbSaving, setKbSaving] = useState(false);
  const [kbSaved, setKbSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/prefs").then((r) => r.json()).then((p) => setPrefs(p)).catch(() => {});
    fetch("/api/kb").then((r) => r.json()).then((d) => { setKb(d.text || ""); setKbDraft(d.text || ""); }).catch(() => {});
  }, []);

  async function saveKb() {
    setKbSaving(true);
    await fetch("/api/kb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: kbDraft }) });
    setKb(kbDraft);
    setKbSaving(false);
    setKbSaved(true);
    setTimeout(() => setKbSaved(false), 2500);
  }

  useEffect(() => { if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight; }, [history, open]);

  async function send() {
    const text = input.trim(); if (!text || loading) return;
    setInput(""); setOpen(true); setLoading(true);
    setHistory((h) => [...h, { role: "user", text, ts: tsNow() }]);

    const local = parseCommand(text, clients);

    const clientList = clients.map((c) =>
      `- "${c.name}" (email:${c.email || "unknown"}, VA:${c.va || "none"}, status:${c.status}, attendees:${c.attendees || 0}/20, ERT:${c.ert || "none"}${c.flag ? ", flag:" + c.flag : ""}${c.ertTime ? ", ERT time:" + c.ertTime : ""})`
    ).join("\n");

    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const todayStr = `${dayNames[now.getDay()]}, ${now.toISOString().slice(0,10)}`;
    const upcoming = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() + i + 1);
      return `  ${dayNames[d.getDay()]} (in ${i+1} day${i ? "s" : ""}): ${d.toISOString().slice(0,10)}`;
    }).join("\n");

    const memorySection = Object.keys(prefs).length
      ? Object.entries(prefs).map(([k, v]) => `- ${k}: ${v}`).join("\n")
      : "Nothing saved yet.";

    const systemPrompt = `You are a smart, proactive AI assistant for Marwan at QCL — a lead generation company. You help manage 25-30 clients who each need 20 attendees for their Executive Roundtable (ERT).

== QCL KNOWLEDGE BASE (rules, guidelines & SOPs — always follow these when advising or drafting) ==
${kb.trim() || "No rules saved yet. The user can add them via the KB button in this panel."}


Today: ${todayStr}
Upcoming dates (use these exactly):
${upcoming}

Current clients:
${clientList || "No clients yet."}

VAs: ${VAS.join(", ")}

== MEMORY (facts you've saved about Marwan — always apply these) ==
${memorySection}

== HOW MEMORY WORKS ==
You can save ANY useful fact to memory using "save_preference" action — not just preferences, but anything worth remembering: Zoom links, timezones, working hours, team info, personal preferences, recurring patterns, etc. Use descriptive keys like: default_location, user_timezone, weekly_standup_time, team_size, etc.
When the user tells you something that seems worth remembering for future conversations (a link, a habit, a preference, a fact about their workflow), save it automatically and mention that you've remembered it.
To remove a memory, use "forget_preference".

== CALENDAR NOTES ==
All event times are in Cairo time (UTC+3). If the user gives a time in another timezone (e.g. CT, EST, PST), convert it to Cairo time before putting it in the event. CT = UTC-6 (so 3pm CT = 9pm Cairo = 21:00). Always auto-apply default_location from memory unless user specifies otherwise.

MEETING DEFAULTS (always apply unless overridden):
- Duration: 30 minutes (set endTime = startTime + 30 mins)
- Title format for client calls: "QCL | Catch Up Call With [Client Name]"
- If the user mentions inviting someone or gives an email, put it in "attendees" — Google Calendar will automatically send them an invitation email.
- If the user says "schedule a call with [client]", use the client's email from the client list as an attendee automatically.

CRITICAL: Return ONLY a raw JSON object. No markdown, no explanation, no code fences. Start with { end with }.

Actions:
- "open_client": view a client
- "update_client": update fields (attendees, status, ert, ertTime, flag, message, targeting, li, va)
- "add_note": log a note. Set noteTitle from context.
- "schedule_meeting": log meeting reminder on a client
- "create_calendar_event": create Google Calendar event. Convert timezone to Cairo if needed.
- "save_preference": save a memory/preference. Pick a clear descriptive key.
- "forget_preference": delete a saved memory.
- "multi_update": multiple client updates at once
- "draft_email": compose an email for a client. Populate emailDraft with to/subject/body.
- "post_to_monday": post a note/update to the client's Monday board. Use mondayText for the message. The system will automatically route it to the right bubble (Scheduling, Messaging, Targeting, etc.).
- "add_task": add a personal task to the task list. Use taskText for the task. Optionally set taskDue (YYYY-MM-DD) and taskPriority ("high" or "normal").
- "show_attention" / "show_va" / "show_overview" / "show_clients": navigate
- "summary": answer a question about client data
- "not_understood": fallback

Status values: "New Client", "Performing", "Slow Generating", "At Risk", "Stopped"
ERT date format: YYYY-MM-DD

Response JSON:
{
  "action": "...",
  "clientName": "name or null",
  "fields": { "attendees": 12, "status": "At Risk", "ert": "2026-06-15", "ertTime": "...", "flag": "...", "li": "..." } or null,
  "note": "note text or null",
  "noteTitle": "short title or null",
  "reply": "friendly 1-2 sentence reply — if you saved a memory, mention it",
  "summary": "answer if action is summary",
  "updates": [ { "clientName": "...", "fields": {...}, "note": "..." } ],
  "event": { "title": "...", "date": "YYYY-MM-DD", "startTime": "HH:MM (24h Cairo)", "endTime": "HH:MM or null", "allDay": false, "location": "...", "attendees": ["email@example.com"] },
  "pref": { "key": "memory_key", "value": "value or null to delete" },
  "emailDraft": { "to": "recipient email or empty", "subject": "...", "body": "full email body" },
  "mondayText": "the text to post to Monday (if action is post_to_monday)",
  "taskText": "the task text (if action is add_task)",
  "taskDue": "due date YYYY-MM-DD or null",
  "taskPriority": "high or normal"
}`;

    // Build conversation history for multi-turn context (last 12 turns)
    const historyMessages = history.slice(-12).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.raw || m.text,
    }));

    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { model: "claude-sonnet-4-6", max_tokens: 2048, system: systemPrompt, messages: [...historyMessages, { role: "user", content: text }] } }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      let parsed: Record<string, unknown>;
      try {
        // Strip markdown fences then find the first {...} JSON object in the response
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
      } catch {
        parsed = { action: "not_understood", reply: "Sorry, I couldn't process that. Please try again." };
      }

      const { action, clientName, fields, note, noteTitle, reply, summary, updates, event, pref, emailDraft, mondayText, taskText, taskDue, taskPriority } = parsed as {
        action: string; clientName?: string; fields?: Record<string, unknown>;
        note?: string; noteTitle?: string; reply?: string; summary?: string;
        updates?: { clientName: string; fields?: Record<string, unknown>; note?: string }[];
        event?: { title: string; date: string; startTime?: string; endTime?: string; allDay?: boolean; location?: string; attendees?: string[] };
        pref?: { key: string; value: string | null };
        emailDraft?: { to: string; subject: string; body: string };
        mondayText?: string;
        taskText?: string; taskDue?: string; taskPriority?: string;
      };

      const resolve = (name?: string) => name ? fuzzyMatch(name, clients) : null;
      const mc = resolve(clientName);

      if (action === "open_client" && mc) { setTab("clients"); setTimeout(() => setModal({ type: "view", id: mc.id }), 80); }
      else if (action === "update_client" && mc && fields) { onAction({ type: "update", clientId: mc.id, fields, noteText: note || `✦ AI: ${text}` }); }
      else if (action === "add_note" && mc && note) { onAction({ type: "note", clientId: mc.id, noteText: note, noteTitle: noteTitle || undefined, aiTagged: true }); }
      else if (action === "schedule_meeting" && mc) {
        const noteText = note || text;
        onAction({ type: "note", clientId: mc.id, noteText, aiTagged: true });
        setNotification({ title: `📅 Meeting noted — ${mc.name}`, body: noteText, clientId: mc.id });
        setTimeout(() => setNotification(null), 7000);
      }
      else if (action === "create_calendar_event" && event) {
        const calRes = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        }).then((r) => r.json());
        if (calRes.ok) {
          window.dispatchEvent(new CustomEvent("cal-refresh"));
        } else {
          const errMsg = calRes.error === "Not connected to Google Calendar"
            ? "Google Calendar isn't connected yet — click 'Connect Google Calendar' in the sidebar panel."
            : `Failed to create event: ${calRes.error || "unknown error"}. Make sure Google Calendar is connected.`;
          setHistory((h) => [...h, { role: "sys", text: errMsg, ts: tsNow() }]);
          setLoading(false);
          return;
        }
      }
      else if ((action === "save_preference" || action === "forget_preference") && pref?.key) {
        const newPrefValue = action === "forget_preference" ? null : pref.value;
        const result = await fetch("/api/prefs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: pref.key, value: newPrefValue }),
        }).then((r) => r.json());
        if (result.prefs) setPrefs(result.prefs);
      }
      else if (action === "multi_update" && updates) {
        for (const u of updates) {
          const uc = resolve(u.clientName);
          if (uc) {
            if (u.fields) onAction({ type: "update", clientId: uc.id, fields: u.fields, noteText: u.note || `✦ AI: ${text}` });
            else if (u.note) onAction({ type: "note", clientId: uc.id, noteText: u.note, aiTagged: true });
          }
        }
      }
      else if (action === "post_to_monday" && mc && mondayText) {
        const res = await fetch("/api/monday/post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientName: mc.name, noteText: mondayText }),
        }).then((r) => r.json());
        const bubbleMsg = res.ok ? ` → posted to **${res.bubble}** bubble` : " (Monday post failed)";
        setHistory((h) => [...h, { role: "sys", text: (reply || `Posted to Monday for ${mc.name}`) + bubbleMsg, raw, ts: tsNow(), clientName: mc.name }]);
        setLoading(false); return;
      }
      else if (action === "add_task" && taskText) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: taskText, dueDate: taskDue || undefined, priority: taskPriority || "normal" }),
        });
        window.dispatchEvent(new CustomEvent("task-refresh"));
      }
      else if (action === "show_attention") setTab("attention");
      else if (action === "show_va") setTab("vas");
      else if (action === "show_overview") setTab("overview");
      else if (action === "show_clients") setTab("clients");

      const finalReply = action === "summary" ? (summary || reply) : (reply || "Done.");
      const notedClient = mc || (updates?.length ? resolve(updates[0].clientName) : null);
      setHistory((h) => [...h, {
        role: action === "draft_email" ? "draft" : "sys",
        text: finalReply || "",
        raw,
        ts: tsNow(),
        clientName: notedClient?.name,
        draft: action === "draft_email" && emailDraft ? emailDraft : undefined,
      }]);
    } catch {
      if (local.action === "nav" && "tab" in local) setTab(local.tab as string);
      else if (local.action === "update" && "client" in local && local.client) onAction({ type: "update", clientId: (local.client as Client).id, fields: (local as { fields: Record<string, unknown> }).fields, noteText: `⚡ ${text}` });
      else if (local.action === "note" && "client" in local && local.client) {
        onAction({ type: "note", clientId: (local.client as Client).id, noteText: (local as { noteText?: string }).noteText || text, aiTagged: true });
        if ("popup" in local && local.popup) { setNotification({ ...(local.popup as { title: string; body: string }), clientId: (local.client as Client).id }); setTimeout(() => setNotification(null), 7000); }
      }
      else if (local.action === "open" && "client" in local && local.client) { setTab("clients"); setTimeout(() => setModal({ type: "view", id: (local.client as Client).id }), 80); }
      setHistory((h) => [...h, { role: "sys", text: "(offline) " + local.reply, ts: tsNow(), clientName: "client" in local ? (local.client as Client | null)?.name : undefined }]);
    }
    setLoading(false);
  }

  const examples = [
    "Dina — 15 attendees confirmed",
    "Mark Greg as At Risk",
    "John's ERT postponed to next Monday",
    "Schedule a team call tomorrow at 2pm",
    "Show needs attention",
    "Remember my Zoom link: zoom.us/j/123",
  ];

  const panelOpen = open;

  return (
    <>
      {/* Notification popup */}
      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 99999, background: "rgba(2,18,28,0.97)", border: "1px solid rgba(0,210,180,0.5)", borderRadius: 14, padding: "14px 18px", maxWidth: 340, boxShadow: "0 8px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(0,210,180,.1)", backdropFilter: "blur(20px)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#7ee8da", marginBottom: 5, letterSpacing: "0.01em" }}>{notification.title}</div>
          <div style={{ fontSize: 12, color: "rgba(216,240,250,0.8)", lineHeight: 1.6 }}>{notification.body}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8 }}>
            <B sm onClick={() => { setNotification(null); setModal({ type: "view", id: notification.clientId }); }}>View client</B>
            <button onClick={() => setNotification(null)} style={{ background: "none", border: "none", color: "rgba(0,210,180,0.5)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      {/* Floating orb toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="ai-orb qcl-btn"
        title="AI Assistant"
        style={{
          position: "fixed", bottom: 28, right: panelOpen ? 388 : 28,
          width: 54, height: 54, borderRadius: "50%", border: "none",
          background: "radial-gradient(circle at 38% 32%, #0a2e2a 0%, #061520 70%)",
          cursor: "pointer", zIndex: 10001,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, color: "#7ee8da",
          transition: "right 0.35s cubic-bezier(0.16,1,0.3,1), transform 0.2s",
          boxShadow: "0 0 24px rgba(0,210,180,0.25)",
        }}
      >🤖</button>

      {/* Backdrop */}
      {panelOpen && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)" }}
        />
      )}

      {/* Side panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 370,
        zIndex: 9999,
        transform: panelOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)",
        display: "flex", flexDirection: "column",
        background: "rgba(2,10,20,0.97)",
        backdropFilter: "blur(28px)",
        borderLeft: "1px solid rgba(0,210,180,0.18)",
        boxShadow: "-24px 0 80px rgba(0,0,0,0.6), -1px 0 0 rgba(56,189,248,0.08)",
      }}>

        {/* Top gradient accent */}
        <div style={{ height: 2, flexShrink: 0, background: "linear-gradient(90deg, transparent 0%, #00d2b4 40%, #38bdf8 70%, transparent 100%)" }} />

        {/* Header */}
        <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(0,210,180,0.12)", flexShrink: 0, position: "relative", overflow: "hidden" }}>
          <div className="ai-scan-line" style={{ position: "absolute", left: 0, right: 0, height: "30%", background: "linear-gradient(180deg, transparent, rgba(0,210,180,0.04), transparent)", pointerEvents: "none", top: 0 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Icon circle */}
            <div style={{
              width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
              background: "radial-gradient(circle at 38% 32%, rgba(0,210,180,0.35) 0%, rgba(56,189,248,0.1) 60%, transparent 100%)",
              border: "1px solid rgba(0,210,180,0.35)",
              boxShadow: "0 0 16px rgba(0,210,180,0.3), inset 0 0 16px rgba(0,210,180,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>🤖</div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 800, letterSpacing: "0.08em",
                fontFamily: "'Syne', sans-serif",
                background: "linear-gradient(90deg, #7ee8da 0%, #38bdf8 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>AI ASSISTANT</div>
              <div style={{ fontSize: 10, color: "rgba(0,210,180,0.45)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 1 }}>
                QCL · Powered by Claude
              </div>
            </div>

            {view === "chat" && history.length > 0 && (
              <button onClick={() => setHistory([])} title="Clear chat" style={{ background: "none", border: "none", color: "rgba(0,210,180,0.35)", cursor: "pointer", fontSize: 11, fontFamily: "inherit", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em" }}>
                CLEAR
              </button>
            )}
            <button
              onClick={() => setView((v) => v === "kb" ? "chat" : "kb")}
              title="Knowledge Base"
              style={{
                background: view === "kb" ? "rgba(0,210,180,0.12)" : "none",
                border: view === "kb" ? "1px solid rgba(0,210,180,0.3)" : "1px solid transparent",
                color: kb.trim() ? "rgba(0,210,180,0.7)" : "rgba(0,210,180,0.3)",
                cursor: "pointer", fontSize: 14, padding: "3px 7px", borderRadius: 6,
                fontFamily: "inherit", transition: "all 0.15s",
              }}
            >⚙</button>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "rgba(0,210,180,0.35)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 4px", transition: "color 0.15s" }}>×</button>
          </div>
        </div>

        {/* KB editor view */}
        {view === "kb" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 18px 0" }}>
            <div style={{ fontSize: 11, color: "rgba(0,210,180,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              QCL Knowledge Base
            </div>
            <div style={{ fontSize: 12, color: "rgba(150,235,225,0.45)", lineHeight: 1.6, marginBottom: 14 }}>
              Paste your QCL rules, SOPs, and guidelines here. The AI will follow these in every response, email draft, and client suggestion.
            </div>
            <textarea
              value={kbDraft}
              onChange={(e) => setKbDraft(e.target.value)}
              placeholder={"Paste your QCL rules here...\n\nExample:\n- Always confirm attendee count before the ERT\n- Clients on RedZone need daily check-ins\n- Standard follow-up email should be sent 7 days before ERT\n- ..."}
              style={{
                flex: 1, resize: "none", background: "rgba(0,210,180,0.04)",
                border: "1px solid rgba(0,210,180,0.18)", borderRadius: 10,
                color: "rgba(216,240,250,0.85)", fontSize: 12, fontFamily: "inherit",
                lineHeight: 1.7, padding: "12px 14px", outline: "none",
                minHeight: 320,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 18px" }}>
              <button
                onClick={saveKb}
                disabled={kbSaving}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                  background: kbSaved ? "rgba(0,210,180,0.15)" : "linear-gradient(135deg, #00d2b4, #38bdf8)",
                  color: kbSaved ? "rgba(0,210,180,0.8)" : "#fff",
                  fontSize: 13, fontWeight: 700, cursor: kbSaving ? "default" : "pointer",
                  fontFamily: "inherit", transition: "all 0.2s",
                  boxShadow: kbSaved ? "none" : "0 0 20px rgba(0,210,180,0.3)",
                }}
              >
                {kbSaved ? "✓ Saved" : kbSaving ? "Saving…" : "Save rules"}
              </button>
              {kbDraft !== kb && !kbSaved && (
                <button onClick={() => setKbDraft(kb)} style={{ background: "none", border: "1px solid rgba(0,210,180,0.15)", color: "rgba(0,210,180,0.4)", borderRadius: 10, padding: "9px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  Revert
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div ref={historyRef} style={{ flex: 1, overflowY: "auto", padding: "16px", display: view === "kb" ? "none" : "flex", flexDirection: "column", gap: 14 }}>

          {/* Empty state */}
          {history.length === 0 && !loading && (
            <div style={{ paddingTop: 8 }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px",
                  background: "radial-gradient(circle at 40% 35%, rgba(0,210,180,0.15), rgba(56,189,248,0.05) 70%, transparent)",
                  border: "1px solid rgba(0,210,180,0.2)",
                  boxShadow: "0 0 32px rgba(0,210,180,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28,
                }}>🤖</div>
                <div style={{ fontSize: 12, color: "rgba(0,210,180,0.5)", letterSpacing: "0.04em" }}>What can I help you with?</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {examples.map((e, i) => (
                  <button key={i} onClick={() => { setInput(e); inputRef.current?.focus(); }}
                    className="ai-suggestion"
                    style={{
                      background: "rgba(0,210,180,0.05)", border: "1px solid rgba(0,210,180,0.12)",
                      borderRadius: 10, padding: "9px 13px", fontSize: 12,
                      color: "rgba(150,235,225,0.65)", cursor: "pointer", textAlign: "left",
                      fontFamily: "inherit", lineHeight: 1.4, transition: "all 0.15s",
                    }}
                  >{e}</button>
                ))}
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="ai-msg" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "radial-gradient(circle, rgba(0,210,180,0.2), transparent)", border: "1px solid rgba(0,210,180,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
              <div style={{ background: "rgba(0,210,180,0.06)", border: "1px solid rgba(0,210,180,0.15)", borderRadius: "4px 14px 14px 14px", padding: "12px 16px", display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="ai-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d2b4", display: "inline-block", animationDelay: `${i * 0.18}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {history.map((m, i) => (
            <div key={i} className="ai-msg" style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {(m.role === "sys" || m.role === "draft") && (
                <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "radial-gradient(circle, rgba(0,210,180,0.18), transparent)", border: "1px solid rgba(0,210,180,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
              )}
              <div style={{ maxWidth: "86%", display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Standard message bubble */}
                <div style={{
                  background: m.role === "user" ? "rgba(56,189,248,0.08)" : "rgba(0,210,180,0.06)",
                  border: `1px solid ${m.role === "user" ? "rgba(56,189,248,0.2)" : "rgba(0,210,180,0.15)"}`,
                  borderRadius: m.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                  padding: "10px 13px",
                  fontSize: 13, color: "rgba(216,240,250,0.9)", lineHeight: 1.6,
                }}>
                  {m.text}
                  {m.clientName && <div style={{ marginTop: 4, fontSize: 11, color: "rgba(0,210,180,0.6)", fontWeight: 600 }}>→ {m.clientName}</div>}
                  <div style={{ fontSize: 10, color: "rgba(0,210,180,0.25)", marginTop: 5 }}>{m.ts}</div>
                </div>

                {/* Draft email card */}
                {m.role === "draft" && m.draft && (
                  <DraftCard draft={m.draft} />
                )}
              </div>
              {m.role === "user" && (
                <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "rgba(56,189,248,0.75)", fontWeight: 700 }}>M</div>
              )}
            </div>
          ))}
        </div>

        {/* Gradient divider + input — hidden in KB view */}
        <div style={{ height: 1, flexShrink: 0, background: "linear-gradient(90deg, transparent, rgba(0,210,180,0.2), rgba(56,189,248,0.15), transparent)", display: view === "kb" ? "none" : "block" }} />

        <div style={{ padding: "14px 16px 18px", flexShrink: 0, display: view === "kb" ? "none" : "block" }}>
          <div style={{
            display: "flex", gap: 10, alignItems: "center",
            background: "rgba(0,210,180,0.03)",
            border: "1px solid rgba(0,210,180,0.22)",
            borderRadius: 14, padding: "6px 6px 6px 14px",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}>
            <input
              ref={inputRef}
              className="ai-inp"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "rgba(216,240,250,0.9)", fontSize: 13, fontFamily: "inherit", padding: "4px 0" }}
              placeholder="Ask anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); if (e.key === "Escape") setOpen(false); }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="qcl-btn"
              style={{
                width: 36, height: 36, borderRadius: 10, border: "none", flexShrink: 0,
                background: (input.trim() && !loading) ? "linear-gradient(135deg, #00d2b4 0%, #38bdf8 100%)" : "rgba(0,210,180,0.07)",
                color: (input.trim() && !loading) ? "#fff" : "rgba(0,210,180,0.25)",
                cursor: (input.trim() && !loading) ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                boxShadow: (input.trim() && !loading) ? "0 0 20px rgba(0,210,180,0.4)" : "none",
                transition: "all 0.2s",
              }}
            >{loading ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>↻</span> : "↑"}</button>
          </div>
          <div style={{ fontSize: 10, color: "rgba(0,210,180,0.2)", textAlign: "center", marginTop: 9, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Powered by Claude · QCL AI
          </div>
        </div>
      </div>
    </>
  );
}