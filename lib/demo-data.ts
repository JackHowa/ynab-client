import "server-only";
import type { Budget, Transaction } from "./ynab";

// Fabricated data so the assistant can be demoed without a real YNAB account.
// Enabled when DEMO_MODE=1 (see lib usage in the copilotkit route).

export const DEMO_BUDGET: Budget = {
  id: "demo-budget",
  name: "Demo Budget",
  last_modified_on: null,
  currency_format: { iso_code: "USD", decimal_digits: 2 },
};

// Build a transaction; dollars is the outflow (stored negative in milliunits).
function t(
  id: string,
  date: string,
  payee: string,
  category: string,
  dollars: number,
): Transaction {
  return {
    id,
    date,
    amount: -Math.round(dollars * 1000),
    payee_name: payee,
    category_name: category,
  };
}

const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];

// Recurring-ish spend with some variation, plus a few one-offs.
export const DEMO_TRANSACTIONS: Transaction[] = MONTHS.flatMap((m, i) => [
  t(`pe-${i}a`, `${m}-05`, "Panda Express", "Dining Out", 12.5 + i),
  t(`pe-${i}b`, `${m}-19`, "Panda Express", "Dining Out", 9.75 + (i % 3)),
  t(`sb-${i}`, `${m}-03`, "Starbucks", "Coffee", 5.4 + (i % 2)),
  t(`wf-${i}`, `${m}-08`, "Whole Foods", "Groceries", 120 + i * 6),
  t(`am-${i}`, `${m}-12`, "Amazon", "Shopping", 45 + (i % 4) * 10),
  t(`sh-${i}`, `${m}-15`, "Shell", "Transportation", 52 + (i % 3) * 4),
  t(`nf-${i}`, `${m}-01`, "Netflix", "Subscriptions", 15.49),
  t(`rt-${i}`, `${m}-01`, "Rent", "Housing", 1850),
]);

export function filterSince(
  txns: Transaction[],
  sinceDate?: string,
): Transaction[] {
  if (!sinceDate) return txns;
  return txns.filter((x) => x.date >= sinceDate);
}
