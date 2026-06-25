/**
 * Minimal typed client for the YNAB API. Runs server-side only.
 * Docs: https://api.ynab.com  |  Spec: https://api.ynab.com/v1
 *
 * Auth uses a Personal Access Token (Bearer). Create one at:
 * https://app.ynab.com/settings/developer
 */

const BASE_URL = "https://api.ynab.com/v1";

export interface YnabError {
  id: string;
  name: string;
  detail: string;
}

export class YnabApiError extends Error {
  constructor(
    public status: number,
    public ynabError?: YnabError,
  ) {
    super(
      ynabError
        ? `YNAB API ${status}: ${ynabError.name} — ${ynabError.detail}`
        : `YNAB API request failed with status ${status}`,
    );
    this.name = "YnabApiError";
  }
}

export interface Budget {
  id: string;
  name: string;
  last_modified_on: string | null;
  currency_format: { iso_code: string; decimal_digits: number } | null;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  on_budget: boolean;
  balance: number; // milliunits (1000 = 1 unit of currency)
  closed: boolean;
}

export class YnabClient {
  constructor(private readonly token: string) {
    if (!token) throw new Error("A YNAB personal access token is required.");
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
      // Always hit YNAB fresh; budget data changes frequently.
      cache: "no-store",
    });

    const body = (await res.json()) as { data?: T; error?: YnabError };

    if (!res.ok) {
      throw new YnabApiError(res.status, body.error);
    }
    return body.data as T;
  }

  /** GET /budgets — list all budgets for the authenticated user. */
  async getBudgets(): Promise<Budget[]> {
    const data = await this.request<{ budgets: Budget[] }>("/budgets");
    return data.budgets;
  }

  /** GET /budgets/{budget_id}/accounts — list accounts for a budget. */
  async getAccounts(budgetId: string): Promise<Account[]> {
    const data = await this.request<{ accounts: Account[] }>(
      `/budgets/${encodeURIComponent(budgetId)}/accounts`,
    );
    return data.accounts;
  }
}

/** Convert YNAB milliunits to a major-currency number (e.g. 1234560 -> 1234.56). */
export const fromMilliunits = (milliunits: number): number => milliunits / 1000;

/** Build a client from the server-side YNAB_TOKEN env var. */
export function ynabFromEnv(): YnabClient {
  const token = process.env.YNAB_TOKEN;
  if (!token) {
    throw new Error(
      "Missing YNAB_TOKEN. Add it to .env.local (see .env.example).",
    );
  }
  return new YnabClient(token);
}
