import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, isConnected } from "@/lib/googleAuth";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: "google_not_configured" }, { status: 422 });
  }
  if (!isConnected(session.userId)) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 422 });
  }

  const token = await getValidAccessToken(session.userId);
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
