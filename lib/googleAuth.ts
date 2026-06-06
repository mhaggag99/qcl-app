import { getSetting, setSetting } from "./db";

export function isConnected(): boolean {
  return !!getSetting("google_refresh_token");
}

export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = getSetting("google_access_token");
  const refreshToken = getSetting("google_refresh_token");
  if (!refreshToken) return null;

  const expiry = parseInt(getSetting("google_token_expiry") ?? "0");
  if (accessToken && Date.now() < expiry - 60000) return accessToken;

  // Refresh
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setSetting("google_access_token", data.access_token);
    setSetting("google_token_expiry", String(Date.now() + (data.expires_in ?? 3600) * 1000));
    return data.access_token as string;
  } catch {
    return null;
  }
}
