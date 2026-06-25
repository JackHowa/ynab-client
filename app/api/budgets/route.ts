import { NextResponse } from "next/server";
import { ynabFromEnv, YnabApiError } from "@/lib/ynab";

// GET /api/budgets — JSON list of the authenticated user's budgets.
export async function GET() {
  try {
    const ynab = ynabFromEnv();
    const budgets = await ynab.getBudgets();
    return NextResponse.json({ budgets });
  } catch (err) {
    const status = err instanceof YnabApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}
