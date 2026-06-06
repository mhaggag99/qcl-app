import type { Client } from "@/types";

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function fmt(d?: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export function daysTo(d?: string): number | null {
  if (!d) return null;
  const t = new Date(d + "T00:00:00");
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - n.getTime()) / 864e5);
}

export function tsNow(): string {
  return new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function needsAttn(c: Client): boolean {
  const d = daysTo(c.ert);
  if (c.status === "At Risk" || c.status === "Stopped") return true;
  if (d !== null && d <= 14 && (c.attendees || 0) < 20) return true;
  if (c.flag && c.flag.trim()) return true;
  return false;
}

export function fuzzyMatch(name: string, clients: Client[]): Client | null {
  const n = name.toLowerCase().trim();
  let best: Client | null = null;
  let bestScore = 0;
  for (const c of clients) {
    const cn = c.name.toLowerCase();
    if (cn === n) return c;
    const parts = cn.split(" ");
    for (const p of parts) {
      if (p.startsWith(n) || n.startsWith(p)) {
        const sc = Math.min(p.length, n.length) / Math.max(p.length, n.length);
        if (sc > bestScore) { bestScore = sc; best = c; }
      }
    }
    if (cn.includes(n) || n.includes(cn)) {
      const sc = Math.min(cn.length, n.length) / Math.max(cn.length, n.length);
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
  }
  return bestScore > 0.4 ? best : null;
}