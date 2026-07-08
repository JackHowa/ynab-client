// Selected-budget scoping. Lets the user pick which YNAB budget the
// assistant should focus on via a dropdown, instead of the model having to
// guess (or juggle) across all of the user's budgets on every question.
//
// Stored in sessionStorage (this tab) and sent to our own runtime
// (/api/copilotkit) as a request header; the server uses it as the default
// `budgetName` whenever a tool call doesn't specify one explicitly.

/** Per-request header carrying the user's selected budget name. */
export const BUDGET_HEADER = "x-selected-budget";

const STORAGE_KEY = "selectedBudget";

/** Read the selected budget name (client only). Null means "all budgets". */
export function getSelectedBudget(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(STORAGE_KEY);
}

/** Persist the selected budget name (client only). */
export function setSelectedBudget(name: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, name);
}

/** Clear the selection, going back to "all budgets" (client only). */
export function clearSelectedBudget(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Build the header set from the stored selection. Used to seed the
 * CopilotKit provider at mount so a selection survives a page reload.
 * Returns an empty object when nothing is selected.
 *
 * Header values must be ISO-8859-1 (the Fetch/Headers API throws otherwise),
 * but budget names are free text and may contain non-Latin1 characters (e.g.
 * a curly apostrophe or emoji) — percent-encode; the route decodes it back.
 */
export function selectedBudgetHeaders(): Record<string, string> {
  const name = getSelectedBudget();
  return name ? { [BUDGET_HEADER]: encodeURIComponent(name) } : {};
}
