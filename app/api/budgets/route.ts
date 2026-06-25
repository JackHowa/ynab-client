import { NextResponse } from "next/server";
import { getSession, setSession, clearSession, type Session } from "@/lib/session";
import { refreshTokens } from "@/lib/oauth";
import { YnabClient, YnabApiError, fromMilliunits } from "@/lib/ynab";

export const runtime = "nodejs";

// Return a valid access token, refreshing (and persisting) it if expired.
async function validAccessToken(session: Session): Promise<string> {
  if (Date.now() < session.expiresAt) return session.accessToken;

  const token = await refreshTokens(session.refreshToken);
  await setSession({
    accessToken: token.access_token,
    // Some providers rotate refresh tokens; keep the new one, else reuse.
    refreshToken: token.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + (token.expires_in - 60) * 1000,
  });
  return token.access_token;
}

// GET /api/budgets — budgets + their open accounts for the logged-in user.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const accessToken = await validAccessToken(session);
    const ynab = new YnabClient(accessToken);
    const budgets = await ynab.getBudgets();

    const data = await Promise.all(
      budgets.map(async (budget) => {
        const accounts = (await ynab.getAccounts(budget.id))
          .filter((a) => !a.closed)
          .map((a) => ({
            id: a.id,
            name: a.name,
            balance: fromMilliunits(a.balance),
          }));
        return {
          id: budget.id,
          name: budget.name,
          currency: budget.currency_format?.iso_code ?? "",
          accounts,
        };
      }),
    );

    return NextResponse.json({ authenticated: true, budgets: data });
  } catch (err) {
    // A 401 (or failed refresh) means the session is no longer usable.
    if (err instanceof YnabApiError && err.status === 401) {
      await clearSession();
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
