import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUserById, saveUserSettings } from "@/lib/db";

function requireAdmin(session: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(request);
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const target = getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const update: Parameters<typeof saveUserSettings>[1] = {};
  if (body.mondayApiToken !== undefined) update.mondayApiToken = body.mondayApiToken;

  saveUserSettings(id, update);
  return NextResponse.json({ ok: true });
}
