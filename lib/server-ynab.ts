import "server-only";
import { getSession, setSession } from "./session";
import { refreshTokens } from "./oauth";

/**
 * Return a valid YNAB access token for the current request's session,
 * refreshing it if expired. Returns null if the user isn't connected.
 * Must be called within a request scope (reads the session cookie).
 */
export async function getValidAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (Date.now() < session.expiresAt) return session.accessToken;

  try {
    const token = await refreshTokens(session.refreshToken);
    await setSession({
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? session.refreshToken,
      expiresAt: Date.now() + (token.expires_in - 60) * 1000,
    });
    return token.access_token;
  } catch {
    return null;
  }
}
