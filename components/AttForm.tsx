"use client";
import React, { useState } from "react";
import { VAS } from "@/lib/constants";
import { B, FRow, FL, MA, inp } from "./ui";

export default function AttForm({ onSave, onClose }: {
  onSave: (f: { va: string; date: string; late: boolean; absent: boolean; ooz: boolean; notes: string }) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    va: "", date: new Date().toISOString().slice(0, 10),
    late: false, absent: false, ooz: false, notes: "",
  });
  const s = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const sb = (k: string) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value === "1" }));

  return (
    <>
      <FRow>
        <FL label="VA *">
          <select style={inp} value={f.va} onChange={s("va")}>
            <option value="">— select —</option>
            {VAS.map((v) => <option key={v}>{v}</option>)}
          </select>
        </FL>
        <FL label="Date *"><input style={inp} type="date" value={f.date} onChange={s("date")} /></FL>
        <FL label="Late?">
          <select style={inp} value={f.late ? "1" : "0"} onChange={sb("late")}>
            <option value="0">No</option><option value="1">Yes</option>
          </select>
        </FL>
        <FL label="Absent?">
          <select style={inp} value={f.absent ? "1" : "0"} onChange={sb("absent")}>
            <option value="0">No</option><option value="1">Yes</option>
          </select>
        </FL>
        <FL label="Out of Zoom?">
          <select style={inp} value={f.ooz ? "1" : "0"} onChange={sb("ooz")}>
            <option value="0">No</option><option value="1">Yes</option>
          </select>
        </FL>
        <FL label="Notes" full>
          <input style={inp} value={f.notes} onChange={s("notes")} placeholder="e.g. Internet issue, No show..." />
        </FL>
      </FRow>
      <MA>
        <B onClick={onClose}>Cancel</B>
        <B primary onClick={() => { if (!f.va || !f.date) { alert("VA and date required"); return; } onSave(f); }}>
          Save entry
        </B>
      </MA>
    </>
  );
}