import { getUserSettings, saveUserSettings } from "./db";

export function isConnected(userId: string): boolean {
  return !!getUserSettings(userId).googleRefreshToken;
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const settings = getUserSettings(userId);
  const { googleAccessToken, googleRefreshToken, googleTokenExpiry } = settings;
  if (!googleRefreshToken) return null;

  const expiry = parseInt(googleTokenExpiry || "0");
  if (googleAccessToken && Date.now() < expiry - 60000) return googleAccessToken;

  // Refresh
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: googleRefreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    saveUserSettings(userId, {
      googleAccessToken: data.access_token,
      googleTokenExpiry: String(Date.now() + (data.expires_in ?? 3600) * 1000),
    });
    return data.access_token as string;
  } catch {
    return null;
  }
}
