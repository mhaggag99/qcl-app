import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db";
import Database from "better-sqlite3";
import path from "path";

// Callable by owner or admin — promotes any user to a given role
export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session || (session.role !== "owner" && session.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  const validRoles = ["owner", "member", "admin"];
  if (!validRoles.includes(body.role)) {
    return NextResponse.json({ error: "role must be owner, member, or admin" }, { status: 400 });
  }

  const user = getUserByEmail(body.email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const db = new Database(path.join(process.cwd(), "data", "qcl.db"));
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(body.role, user.id);

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: body.role } });
}
