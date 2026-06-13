import { NextRequest, NextResponse } from "next/server";
import { hashPassword, getSessionUser } from "@/lib/auth";
import { countUsers, createUser, migrateDataToOwner } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password || !body?.name) {
    return NextResponse.json({ error: "email, password and name are required" }, { status: 400 });
  }

  const userCount = countUsers();
  const isFirstUser = userCount === 0;

  // Only the first registration (owner) is open. After that, only an existing owner can create accounts.
  if (!isFirstUser) {
    const session = await getSessionUser(request);
    if (!session || (session.role !== "owner" && session.role !== "admin")) {
      return NextResponse.json({ error: "Only an owner or admin can create new accounts" }, { status: 403 });
    }
  }

  const role = isFirstUser ? "owner" : "member";
  const passwordHash = await hashPassword(body.password);

  try {
    const user = createUser(body.email, passwordHash, body.name, role);

    // First user: migrate all pre-existing data to the owner account
    if (isFirstUser) {
      migrateDataToOwner(user.id);
    }

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE")) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
