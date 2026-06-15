import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/register", "/api/auth/logout"];
const SETUP_PATHS  = ["/setup", "/api/setup", "/api/auth/me", "/api/auth/logout"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const session = await getSessionUser(request);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isAuthRoute = pathname.startsWith("/api/auth");

  // Admin users are confined to /admin and /api/admin (+ /api/auth for logout/me)
  if (session.role === "admin") {
    if (!isAdminRoute && !isAuthRoute) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Non-admin users cannot access admin routes
  if (isAdminRoute) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Members/owners who haven't completed setup → redirect to /setup (except setup routes themselves)
  // Use strict === false so old JWTs (where setupDone is undefined) are not affected
  const onSetupPath = SETUP_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (session.setupDone === false && !onSetupPath) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Workspace setup required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
