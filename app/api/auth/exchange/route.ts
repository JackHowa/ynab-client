import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode } from "@/lib/oauth";
import { setSession } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/auth/exchange — called by the home page after YNAB redirects back
// to "/" with ?code & ?state. Verifies state, exchanges the code for tokens,
// and sets the encrypted session cookie.
export async function POST(req: NextRequest) {
  const { code, state } = (await req.json()) as {
    code?: string;
    state?: string;
  };

  const store = await cookies();
  const expectedState = store.get("ynab_oauth_state")?.value;
  const verifier = store.get("ynab_oauth_verifier")?.value;

  store.delete("ynab_oauth_state");
  store.delete("ynab_oauth_verifier");

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.json({ error: "invalid_oauth_state" }, { status: 400 });
  }

  try {
    // Same redirect URI as the authorize request: this app's origin.
    const token = await exchangeCode(req.nextUrl.origin, code, verifier);
    await setSession({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + (token.expires_in - 60) * 1000,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "token_exchange_failed" }, { status: 502 });
  }
}
