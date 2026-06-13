import { NextRequest, NextResponse } from "next/server";
import { isConnected, getValidAccessToken } from "@/lib/googleAuth";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface CalEvent {
  id: string;
  title: string;
  startTime: string;   // "9:00 AM" or "" for all-day
  endTime: string;     // "10:00 AM" or ""
  allDay: boolean;
  location: string;
  description: string;
}

// Cairo summer time = UTC+3 (EEST, April–October)
const TZ_OFFSET_H = 3;

function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 3600000);
}

function toLocalDateStr(d: Date) {
  return addHours(d, TZ_OFFSET_H).toISOString().slice(0, 10);
}

function toTimeStr(d: Date) {
  const l = addHours(d, TZ_OFFSET_H);
  const h = l.getUTCHours(), m = l.getUTCMinutes().toString().padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

// Known timezone offsets (hours from UTC, approximate — enough for display)
const TZ_MAP: Record<string, number> = {
  "America/New_York": -4, "America/Chicago": -5, "America/Denver": -6,
  "America/Los_Angeles": -7, "America/Phoenix": -7,
  "Europe/London": 1, "Europe/Paris": 2, "Europe/Berlin": 2,
  "Asia/Dubai": 4, "Asia/Riyadh": 3, "Africa/Cairo": 3,
  "America/Toronto": -4, "America/Vancouver": -7,
  "UTC": 0, "GMT": 0,
};

function parseIcsDate(val: string, tzid?: string): { date: Date; allDay: boolean } | null {
  // All-day: DTSTART;VALUE=DATE:20260529 or just 8-digit
  const allDayMatch = val.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (allDayMatch) {
    const [, y, mo, d] = allDayMatch;
    return { date: new Date(`${y}-${mo}-${d}T00:00:00Z`), allDay: true };
  }
  // UTC: ends with Z
  const utcMatch = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utcMatch) {
    const [, y, mo, d, h, mi, s] = utcMatch;
    return { date: new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`), allDay: false };
  }
  // Local with TZID
  const localMatch = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    const [, y, mo, d, h, mi, s] = localMatch;
    const tzOff = tzid ? (TZ_MAP[tzid] ?? 0) : 0;
    const utcDate = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
    // Convert local→UTC: subtract tz offset
    return { date: new Date(utcDate.getTime() - tzOff * 3600000), allDay: false };
  }
  return null;
}

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function rruleOccursOnDate(rrule: string, dtStart: Date, targetStr: string): boolean {
  const target = new Date(targetStr + "T00:00:00Z");
  const startStr = toLocalDateStr(dtStart);
  if (startStr > targetStr) return false;

  // Check UNTIL — handle both DATE (YYYYMMDD) and DATE-TIME (YYYYMMDDTHHMMSSz)
  const untilRaw = rrule.match(/UNTIL=([\dT:Z]+)/)?.[1];
  if (untilRaw) {
    let untilDate: Date;
    if (untilRaw.includes("T")) {
      // Full datetime — parse as UTC
      const m = untilRaw.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
      if (m) untilDate = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
      else untilDate = new Date(untilRaw);
    } else {
      untilDate = new Date(untilRaw.slice(0,4) + "-" + untilRaw.slice(4,6) + "-" + untilRaw.slice(6,8) + "T23:59:59Z");
    }
    // Event on targetStr would start at same time-of-day as dtStart but on target date
    const dtStartTimeUTC = dtStart.getUTCHours() * 3600 + dtStart.getUTCMinutes() * 60;
    const eventUTCOnTarget = target.getTime() + dtStartTimeUTC * 1000;
    if (eventUTCOnTarget > untilDate.getTime()) return false;
  }

  const freq = rrule.match(/FREQ=(\w+)/)?.[1] ?? "";
  const byDay = rrule.match(/BYDAY=([^;:\s]+)/)?.[1] ?? "";
  const interval = parseInt(rrule.match(/INTERVAL=(\d+)/)?.[1] ?? "1");
  const targetDay = WEEKDAYS[target.getUTCDay()];

  if (freq === "DAILY") {
    const startMidnight = new Date(startStr + "T00:00:00Z");
    const diff = Math.round((target.getTime() - startMidnight.getTime()) / 86400000);
    return diff >= 0 && diff % interval === 0;
  }
  if (freq === "WEEKLY") {
    const days = byDay
      ? byDay.split(",").map((d) => d.replace(/[+-\d]/g, "").trim())
      : [WEEKDAYS[addHours(dtStart, TZ_OFFSET_H).getUTCDay()]];
    if (!days.includes(targetDay)) return false;
    const startMidnight = new Date(startStr + "T00:00:00Z");
    const diffWeeks = Math.floor((target.getTime() - startMidnight.getTime()) / (7 * 86400000));
    return diffWeeks >= 0 && diffWeeks % interval === 0;
  }
  if (freq === "MONTHLY") {
    const startLocal = addHours(dtStart, TZ_OFFSET_H);
    return startLocal.getUTCDate() === target.getUTCDate();
  }
  return false;
}

interface IcsEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  tzidStart?: string;
  tzidEnd?: string;
  rrule: string;
  recurrenceId: string;   // non-empty = this is a one-off exception, not a base recurrence
  exdates: string[];      // excluded dates for the base recurring event
  location: string;
  description: string;
}

function parseIcs(text: string): IcsEvent[] {
  // Unfold continuation lines (RFC 5545: CRLF + whitespace)
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const blocks = unfolded.split(/BEGIN:VEVENT/);
  blocks.shift();

  return blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const props: Record<string, string> = {};
    const params: Record<string, Record<string, string>> = {};

    for (const line of lines) {
      if (line.startsWith("END:VEVENT")) break;
      const ci = line.indexOf(":");
      if (ci < 0) continue;
      const keyFull = line.slice(0, ci);
      const value = line.slice(ci + 1);
      // Parse key and parameters: DTSTART;TZID=America/New_York
      const parts = keyFull.split(";");
      const key = parts[0];
      const p: Record<string, string> = {};
      for (const part of parts.slice(1)) {
        const [pk, pv] = part.split("=");
        if (pk && pv) p[pk] = pv;
      }
      props[key] = value;
      if (Object.keys(p).length) params[key] = p;
    }

    // Collect all EXDATE values
    const exdates: string[] = Object.entries(props)
      .filter(([k]) => k.startsWith("EXDATE"))
      .flatMap(([, v]) => v.split(",").map((d) => d.slice(0, 8)));

    return {
      uid: props["UID"] ?? "",
      summary: (props["SUMMARY"] ?? "").replace(/\\n/g, " ").replace(/\\,/g, ",").trim(),
      dtstart: props["DTSTART"] ?? "",
      dtend: props["DTEND"] ?? "",
      tzidStart: params["DTSTART"]?.["TZID"],
      tzidEnd: params["DTEND"]?.["TZID"],
      rrule: props["RRULE"] ?? "",
      recurrenceId: props["RECURRENCE-ID"] ?? "",
      exdates,
      location: (props["LOCATION"] ?? "").replace(/\\,/g, ",").replace(/\\n/g, " ").trim(),
      description: (props["DESCRIPTION"] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\\n/g, " ")
        .replace(/\\,/g, ",")
        .trim()
        .slice(0, 150),
    };
  });
}

// ─── Google Calendar API path ───────────────────────────────────────────────

function gCalEventToCalEvent(item: Record<string, unknown>): CalEvent {
  const start = item.start as Record<string, string>;
  const end = item.end as Record<string, string>;
  const allDay = !!start.date && !start.dateTime;

  let startTime = "";
  let endTime = "";
  if (!allDay && start.dateTime) {
    const d = new Date(start.dateTime);
    startTime = toTimeStr(d);
    if (end.dateTime) endTime = toTimeStr(new Date(end.dateTime));
  }

  return {
    id: (item.id as string) ?? "",
    title: (item.summary as string) || "(No title)",
    startTime,
    endTime,
    allDay,
    location: (item.location as string) || "",
    description: ((item.description as string) || "").replace(/<[^>]+>/g, "").slice(0, 150),
  };
}

async function fetchFromGoogleAPI(userId: string): Promise<{ today: CalEvent[]; tomorrow: CalEvent[] }> {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error("No valid token");

  const now = new Date();
  const todayStr = toLocalDateStr(now);
  const tomorrowStr = toLocalDateStr(new Date(now.getTime() + 86400000));

  // Fetch a 2-day window: start of today → end of tomorrow (Cairo UTC+3)
  const timeMin = new Date(todayStr + "T00:00:00+03:00").toISOString();
  const timeMax = new Date(tomorrowStr + "T23:59:59+03:00").toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
    timeZone: "Africa/Cairo",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Google API ${res.status}`);
  const data = await res.json();

  const todayEvents: CalEvent[] = [];
  const tomorrowEvents: CalEvent[] = [];

  for (const item of (data.items ?? []) as Record<string, unknown>[]) {
    const start = item.start as Record<string, string>;
    const dateStr = (start.date ?? start.dateTime ?? "").slice(0, 10);
    // Convert dateStr to Cairo local date
    const localDate = start.dateTime
      ? toLocalDateStr(new Date(start.dateTime))
      : dateStr;
    const ev = gCalEventToCalEvent(item);
    if (localDate === todayStr) todayEvents.push(ev);
    else if (localDate === tomorrowStr) tomorrowEvents.push(ev);
  }

  return { today: todayEvents, tomorrow: tomorrowEvents };
}

// ─── iCal fallback path ──────────────────────────────────────────────────────

async function fetchFromICal(): Promise<{ today: CalEvent[]; tomorrow: CalEvent[] }> {
  const url = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (!url) throw new Error("No iCal URL");

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const rawEvents = parseIcs(text);

  const now = new Date();
  const todayStr = toLocalDateStr(now);
  const tomorrowStr = toLocalDateStr(new Date(now.getTime() + 86400000));

  const todayEvents: CalEvent[] = [];
  const tomorrowEvents: CalEvent[] = [];

  const overriddenDates: Record<string, Set<string>> = {};
  for (const ev of rawEvents) {
    if (ev.recurrenceId && ev.uid) {
      const parsed = parseIcsDate(ev.recurrenceId, ev.tzidStart);
      if (parsed) {
        if (!overriddenDates[ev.uid]) overriddenDates[ev.uid] = new Set();
        overriddenDates[ev.uid].add(toLocalDateStr(parsed.date));
      }
    }
  }

  for (const ev of rawEvents) {
    if (!ev.dtstart) continue;
    const startParsed = parseIcsDate(ev.dtstart, ev.tzidStart);
    if (!startParsed) continue;
    const endParsed = ev.dtend ? parseIcsDate(ev.dtend, ev.tzidEnd) : null;

    const makeEntry = (): CalEvent => ({
      id: ev.uid + ev.recurrenceId,
      title: ev.summary || "(No title)",
      startTime: startParsed.allDay ? "" : toTimeStr(startParsed.date),
      endTime: endParsed && !endParsed.allDay ? toTimeStr(endParsed.date) : "",
      allDay: startParsed.allDay,
      location: ev.location,
      description: ev.description,
    });

    const startLocalStr = toLocalDateStr(startParsed.date);

    if (ev.recurrenceId) {
      if (startLocalStr === todayStr) todayEvents.push(makeEntry());
      else if (startLocalStr === tomorrowStr) tomorrowEvents.push(makeEntry());
    } else if (!ev.rrule) {
      if (startLocalStr === todayStr) todayEvents.push(makeEntry());
      else if (startLocalStr === tomorrowStr) tomorrowEvents.push(makeEntry());
    } else {
      const overrides = overriddenDates[ev.uid] ?? new Set();
      const exdateSet = new Set(ev.exdates);
      if (rruleOccursOnDate(ev.rrule, startParsed.date, todayStr) && !overrides.has(todayStr) && !exdateSet.has(todayStr.replace(/-/g, "")))
        todayEvents.push(makeEntry());
      if (rruleOccursOnDate(ev.rrule, startParsed.date, tomorrowStr) && !overrides.has(tomorrowStr) && !exdateSet.has(tomorrowStr.replace(/-/g, "")))
        tomorrowEvents.push(makeEntry());
    }
  }

  const byTime = (a: CalEvent, b: CalEvent) => (a.startTime || "00:00 AM").localeCompare(b.startTime || "00:00 AM");
  todayEvents.sort(byTime);
  tomorrowEvents.sort(byTime);

  return { today: todayEvents, tomorrow: tomorrowEvents };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (isConnected(session.userId)) {
      const data = await fetchFromGoogleAPI(session.userId);
      return NextResponse.json(data);
    }
    const data = await fetchFromICal();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Calendar error:", err);
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}
