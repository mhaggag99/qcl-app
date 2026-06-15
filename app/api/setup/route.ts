import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, signToken, makeSessionCookie } from "@/lib/auth";
import { markSetupDone, saveUserVAs, createClient } from "@/lib/db";
import type { Client } from "@/types";

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const vas: string[] = Array.isArray(body.vas) ? body.vas.filter((v: unknown) => typeof v === "string" && v.trim()) : [];
  const clients: Partial<Client>[] = Array.isArray(body.clients) ? body.clients : [];

  // Save VA list for this user
  if (vas.length > 0) saveUserVAs(session.userId, vas);

  // Bulk-insert clients
  const today = new Date().toISOString().slice(0, 10);
  for (const c of clients) {
    if (!c.name?.trim()) continue;
    createClient({
      name: c.name.trim(),
      email: c.email ?? "",
      va: c.va ?? "",
      start: c.start ?? today,
      status: c.status ?? "New Client",
      li: c.li ?? "",
      ert: c.ert ?? "",
      ertTime: c.ertTime ?? "",
      attendees: c.attendees ?? 0,
      registered: c.registered ?? 0,
      message: c.message ?? "",
      targeting: c.targeting ?? "",
      flag: c.flag ?? "",
      redzone: false,
      notes: [],
    }, session.userId);
  }

  // Mark setup complete
  markSetupDone(session.userId);

  // Re-issue JWT with setupDone: true so middleware allows access
  const newToken = await signToken({ userId: session.userId, email: session.email, role: session.role, setupDone: true });
  const res = NextResponse.json({ ok: true, clientsCreated: clients.filter(c => c.name?.trim()).length });
  res.headers.set("Set-Cookie", makeSessionCookie(newToken));
  return res;
}
