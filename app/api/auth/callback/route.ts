import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { saveUserSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?cal_error=1", request.url));
  }

  const session = await getSessionUser(request);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) throw new Error("Token exchange failed");

    const data = await res.json();
    saveUserSettings(session.userId, {
      googleAccessToken: data.access_token,
      googleRefreshToken: data.refresh_token,
      googleTokenExpiry: String(Date.now() + (data.expires_in ?? 3600) * 1000),
    });

    return NextResponse.redirect(new URL("/?cal_connected=1", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?cal_error=1", request.url));
  }
}
