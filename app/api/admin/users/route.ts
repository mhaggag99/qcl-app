import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { getAllUsers, createUser, getUserSettings } from "@/lib/db";

function requireAdmin(session: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const session = await getSessionUser(request);
  const denied = requireAdmin(session);
  if (denied) return denied;

  const users = getAllUsers();
  const result = users.map((u) => {
    const settings = getUserSettings(u.id);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      mondayConfigured: !!settings.mondayApiToken,
      googleConnected: !!settings.googleAccessToken,
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({ users: result });
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password || !body?.name) {
    return NextResponse.json({ error: "email, password and name are required" }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(body.password);
    const user = createUser(body.email, passwordHash, body.name, "member");
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE")) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
