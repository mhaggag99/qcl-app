import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, isConnected } from "@/lib/googleAuth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isConnected()) {
    return NextResponse.json({ error: "Not connected to Google Calendar" }, { status: 401 });
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Failed to get access token" }, { status: 401 });
  }

  const { title, date, startTime, endTime, allDay, location, description, attendees } = await request.json();
  if (!title || !date) {
    return NextResponse.json({ error: "title and date are required" }, { status: 400 });
  }

  const attendeeList: { email: string }[] = Array.isArray(attendees)
    ? attendees.filter((e: unknown) => typeof e === "string" && e.includes("@")).map((e: string) => ({ email: e.trim() }))
    : [];

  let body: Record<string, unknown>;

  if (allDay) {
    const endDate = new Date(date + "T00:00:00Z");
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const endDateStr = endDate.toISOString().slice(0, 10);
    body = {
      summary: title,
      start: { date },
      end: { date: endDateStr },
      ...(location ? { location } : {}),
      ...(description ? { description } : {}),
      ...(attendeeList.length ? { attendees: attendeeList } : {}),
    };
  } else {
    // Timed event — times are in "HH:MM" 24h format, Cairo = UTC+3
    const start = `${date}T${startTime || "09:00"}:00+03:00`;
    const end = `${date}T${endTime || startTime || "10:00"}:00+03:00`;
    body = {
      summary: title,
      start: { dateTime: start, timeZone: "Africa/Cairo" },
      end: { dateTime: end, timeZone: "Africa/Cairo" },
      ...(location ? { location } : {}),
      ...(description ? { description } : {}),
      ...(attendeeList.length ? { attendees: attendeeList } : {}),
    };
  }

  // sendUpdates=all → Google sends invitation emails to all attendees
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: "Google API error", details: err }, { status: res.status });
  }

  const created = await res.json();
  return NextResponse.json({ ok: true, id: created.id });
}
