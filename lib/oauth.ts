/**
 * YNAB OAuth 2.0 (Authorization Code grant + PKCE, read-only scope).
 * Endpoints: https://app.ynab.com/oauth/authorize and /oauth/token
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";

const AUTHORIZE_URL = "https://app.ynab.com/oauth/authorize";
const TOKEN_URL = "https://app.ynab.com/oauth/token";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
}

export function oauthConfig(): OAuthConfig {
  const clientId = process.env.YNAB_CLIENT_ID;
  const clientSecret = process.env.YNAB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing env vars: YNAB_CLIENT_ID, YNAB_CLIENT_SECRET.");
  }
  return { clientId, clientSecret };
}

const base64url = (b: Buffer) => b.toString("base64url");

export function randomToken(): string {
  return base64url(randomBytes(32));
}

/** PKCE: a verifier and its S256 challenge. */
export function pkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function authorizeUrl(
  redirectUri: string,
  state: string,
  codeChallenge: string,
): string {
  const { clientId } = oauthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    scope: "read-only",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YNAB token endpoint ${res.status}: ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(
  redirectUri: string,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const { clientId, clientSecret } = oauthConfig();
  return postToken({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
  });
}

export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = oauthConfig();
  return postToken({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}
