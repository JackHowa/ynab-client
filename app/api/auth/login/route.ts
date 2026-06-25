import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorizeUrl, pkce, randomToken } from "@/lib/oauth";

export const runtime = "nodejs";

// GET /api/auth/login — begin the OAuth flow: stash state + PKCE verifier in
// short-lived httpOnly cookies, then redirect to YNAB's consent screen.
//
// The redirect URI is the app's own origin (e.g. http://localhost:3000), which
// must be registered on the YNAB OAuth app. YNAB exact-matches it, and returns
// the auth code to "/", where the home page completes the exchange.
export async function GET(req: NextRequest) {
  const state = randomToken();
  const { verifier, challenge } = pkce();
  const redirectUri = req.nextUrl.origin;

  const store = await cookies();
  const transient = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax (not Strict): the callback is a top-level navigation from YNAB,
    // so the cookies must still be sent on that cross-site redirect.
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  store.set("ynab_oauth_state", state, transient);
  store.set("ynab_oauth_verifier", verifier, transient);

  return NextResponse.redirect(authorizeUrl(redirectUri, state, challenge));
}
