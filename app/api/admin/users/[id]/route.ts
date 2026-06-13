import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { deleteUser, getUserById, updateUserPassword } from "@/lib/db";

function requireAdmin(session: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(request);
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const target = getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "Cannot delete the owner account" }, { status: 400 });
  if (target.id === session!.userId) return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });

  deleteUser(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(request);
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.password) return NextResponse.json({ error: "password is required" }, { status: 400 });

  const target = getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const newHash = await hashPassword(body.password);
  updateUserPassword(id, newHash);

  return NextResponse.json({ ok: true });
}
