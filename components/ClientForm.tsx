"use client";
import React, { useState } from "react";
import type { Client } from "@/types";
import { VAS, STATUSES } from "@/lib/constants";
import { useTheme } from "@/lib/theme";
import { B, FRow, FL, MA, inp, tex } from "./ui";

const blank: Omit<Client, "id" | "notes"> & { note: string } = {
  name: "", email: "", va: "", start: "", status: "New Client", li: "",
  ert: "", ertTime: "", attendees: 0, registered: 0,
  message: "", targeting: "", flag: "", redzone: false, note: "",
};

export default function ClientForm({
  init, onSave, onClose,
}: {
  init?: Client;
  onSave: (f: typeof blank) => void;
  onClose: () => void;
}) {
  const { D } = useTheme();
  const [f, setF] = useState(
    init ? { ...blank, ...init, note: "", attendees: init.attendees ?? 0, registered: init.registered ?? 0 } : blank
  );
  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <>
      <FRow>
        <FL label="Client name *"><input style={inp} value={f.name} onChange={s("name")} placeholder="e.g. John Dowling" /></FL>
        <FL label="Email"><input style={inp} value={f.email} onChange={s("email")} placeholder="email@example.com" /></FL>
        <FL label="Assigned VA">
          <select style={inp} value={f.va} onChange={s("va")}>
            <option value="">— select —</option>
            {VAS.map((v) => <option key={v}>{v}</option>)}
          </select>
        </FL>
        <FL label="Start date"><input style={inp} type="month" value={f.start} onChange={s("start")} /></FL>
        <FL label="Campaign status">
          <select style={inp} value={f.status} onChange={s("status")}>
            {STATUSES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </FL>
        <FL label="LinkedIn events">
          <select style={inp} value={f.li} onChange={s("li")}>
            <option value="">—</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>Not Eligible</option>
          </select>
        </FL>
        <FL label="Next ERT date"><input style={inp} type="date" value={f.ert} onChange={s("ert")} /></FL>
        <FL label="ERT time"><input style={inp} value={f.ertTime} onChange={s("ertTime")} placeholder="e.g. 2:00 PM EST" /></FL>
        <FL label="Attendees confirmed"><input style={inp} type="number" min="0" value={f.attendees} onChange={s("attendees")} /></FL>
        <FL label="Registered for next ERT"><input style={inp} type="number" min="0" value={f.registered} onChange={s("registered")} /></FL>
        <FL label="Platform" full>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer",
            padding: "8px 12px", borderRadius: 8,
            background: f.redzone ? `${D.red}10` : D.bg3,
            border: `1px solid ${f.redzone ? `${D.red}40` : D.border}`,
            transition: "background 0.15s, border-color 0.15s",
          }}>
            <input
              type="checkbox"
              checked={f.redzone}
              onChange={(e) => setF((p) => ({ ...p, redzone: e.target.checked }))}
              style={{ accentColor: D.red, width: 15, height: 15, cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, color: f.redzone ? D.red : D.muted, fontWeight: f.redzone ? 600 : 400 }}>
              On <strong style={{ color: D.red }}>RedZone</strong> platform
            </span>
          </label>
        </FL>
        <FL label="Outreach message" full>
          <textarea style={tex} value={f.message} onChange={s("message")} placeholder="Paste current outreach message..." />
        </FL>
        <FL label="Targeting filters" full>
          <textarea style={tex} value={f.targeting} onChange={s("targeting")} placeholder="e.g. 500M-1B revenue, manufacturing, C-suite..." />
        </FL>
        <FL label="Flag" full>
          <input style={inp} value={f.flag} onChange={s("flag")} placeholder="e.g. postpone ERT, waiting on lead list..." />
        </FL>
        <FL label="Add note" full>
          <input style={inp} value={f.note} onChange={s("note")} placeholder="Optional note to log" />
        </FL>
      </FRow>
      <MA>
        <B onClick={onClose}>Cancel</B>
        <B primary onClick={() => { if (!f.name.trim()) { alert("Client name required"); return; } onSave(f); }}>
          Save client
        </B>
      </MA>
    </>
  );
}
