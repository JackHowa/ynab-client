import {
  CopilotRuntime,
  BuiltInAgent,
  InMemoryAgentRunner,
  defineTool,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import { handle } from "hono/vercel";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { YnabClient, fromMilliunits, type Budget, type Transaction } from "@/lib/ynab";
import { getValidAccessToken } from "@/lib/server-ynab";
import {
  DEMO_BUDGET,
  DEMO_TRANSACTIONS,
  DEMO_ACCOUNTS,
  filterSince,
} from "@/lib/demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Carries the current request's YNAB access token into server-side tool
// execution (tools don't receive the request, so we seed this per-request).
const tokenStore = new AsyncLocalStorage<string | null>();

type LoadResult =
  | { budget: Budget; transactions: Transaction[] }
  | { error: string };

// Single data source for the tools: DEMO_MODE -> fabricated data; otherwise the
// connected YNAB budget. Returns an { error } the agent can relay.
// budgetName: match a specific budget (partial, case-insensitive). When omitted,
// uses the most-recently-modified budget (not always budgets[0]).
async function loadData(opts: {
  budgetName?: string;
  sinceDate?: string;
}): Promise<LoadResult> {
  if (process.env.DEMO_MODE === "1") {
    return {
      budget: DEMO_BUDGET,
      transactions: filterSince(DEMO_TRANSACTIONS, opts.sinceDate),
    };
  }
  const token = tokenStore.getStore();
  if (!token)
    return {
      error:
        "Not connected to YNAB. Ask the user to connect their account on the home page (or enable DEMO_MODE).",
    };
  const ynab = new YnabClient(token);
  const budgets = await ynab.getBudgets();
  if (budgets.length === 0) return { error: "No budgets found." };

  const selected = selectBudget(budgets, opts.budgetName);
  if ("error" in selected) return selected;
  const transactions = await ynab.getTransactions(selected.budget.id, opts.sinceDate);
  return { budget: selected.budget, transactions };
}

// Choose a budget by name (partial) or default to most-recently modified.
function selectBudget(
  budgets: Budget[],
  budgetName?: string,
): { budget: Budget } | { error: string } {
  if (budgetName) {
    const q = budgetName.toLowerCase();
    const match = budgets.find((b) => b.name.toLowerCase().includes(q));
    if (!match)
      return {
        error: `No budget matching "${budgetName}". Available: ${budgets
          .map((b) => b.name)
          .join(", ")}.`,
      };
    return { budget: match };
  }
  const budget = [...budgets].sort((a, b) =>
    (b.last_modified_on ?? "").localeCompare(a.last_modified_on ?? ""),
  )[0];
  return { budget };
}

const getBudgetOverview = defineTool({
  name: "getBudgetOverview",
  description:
    "Get a budget's open accounts and balances. Use before rendering " +
    "budgetCard for account-balance / budget-overview questions.",
  parameters: z.object({
    budgetName: z
      .string()
      .optional()
      .describe("Which budget (name, partial ok). Defaults to most recent."),
  }),
  execute: async ({ budgetName }) => {
    if (process.env.DEMO_MODE === "1") {
      return {
        budgetName: DEMO_BUDGET.name,
        currency: DEMO_BUDGET.currency_format?.iso_code ?? "",
        accounts: DEMO_ACCOUNTS.filter((a) => !a.closed).map((a) => ({
          name: a.name,
          balance: fromMilliunits(a.balance),
        })),
      };
    }
    const token = tokenStore.getStore();
    if (!token) return { error: "Not connected to YNAB." };
    const ynab = new YnabClient(token);
    const budgets = await ynab.getBudgets();
    if (budgets.length === 0) return { error: "No budgets found." };
    const selected = selectBudget(budgets, budgetName);
    if ("error" in selected) return selected;
    const accounts = await ynab.getAccounts(selected.budget.id);
    return {
      budgetName: selected.budget.name,
      currency: selected.budget.currency_format?.iso_code ?? "",
      accounts: accounts
        .filter((a) => !a.closed)
        .map((a) => ({ name: a.name, balance: fromMilliunits(a.balance) })),
    };
  },
});

const listBudgets = defineTool({
  name: "listBudgets",
  description:
    "List the user's YNAB budgets by name. Use this to pick the right budget " +
    "when the user mentions one, or to show what's available.",
  parameters: z.object({}),
  execute: async () => {
    if (process.env.DEMO_MODE === "1") return { budgets: [DEMO_BUDGET.name] };
    const token = tokenStore.getStore();
    if (!token) return { error: "Not connected to YNAB." };
    const ynab = new YnabClient(token);
    const budgets = await ynab.getBudgets();
    return { budgets: budgets.map((b) => b.name) };
  },
});

const getSpendingByCategory = defineTool({
  name: "getSpendingByCategory",
  description:
    "Total spending grouped by category from the user's connected YNAB budget. " +
    "Returns one slice per category. To COMBINE categories (e.g. Dining + " +
    "Coffee), sum the relevant slice values yourself before rendering.",
  parameters: z.object({
    budgetName: z
      .string()
      .optional()
      .describe("Which budget (name, partial ok). Defaults to most recent."),
    sinceDate: z
      .string()
      .optional()
      .describe("Only include transactions on/after this ISO date (YYYY-MM-DD)"),
  }),
  execute: async ({ budgetName, sinceDate }) => {
    const loaded = await loadData({ budgetName, sinceDate });
    if ("error" in loaded) return loaded;
    const { budget, transactions } = loaded;
    const byCategory: Record<string, number> = {};
    for (const t of transactions) {
      if (t.amount >= 0) continue; // outflows only
      const name = t.category_name ?? "Uncategorized";
      byCategory[name] = (byCategory[name] ?? 0) + -t.amount;
    }
    return {
      budget: budget.name,
      currency: budget.currency_format?.iso_code ?? "",
      slices: Object.entries(byCategory)
        .map(([name, amount]) => ({ name, value: fromMilliunits(amount) }))
        .sort((a, b) => b.value - a.value),
    };
  },
});

const getSpendingByPayee = defineTool({
  name: "getSpendingByPayee",
  description:
    "How much the user has spent at a given payee/merchant (e.g. 'Panda " +
    "Express'), with a monthly breakdown. Reads their connected YNAB budget.",
  parameters: z.object({
    payee: z
      .string()
      .describe("Merchant/payee name to match (case-insensitive substring)"),
    budgetName: z
      .string()
      .optional()
      .describe("Which budget (name, partial ok). Defaults to most recent."),
    sinceDate: z
      .string()
      .optional()
      .describe("Only include transactions on/after this ISO date (YYYY-MM-DD)"),
  }),
  execute: async ({ payee, budgetName, sinceDate }) => {
    const loaded = await loadData({ budgetName, sinceDate });
    if ("error" in loaded) return loaded;
    const { budget, transactions: txns } = loaded;
    const q = payee.toLowerCase();
    const matches = txns.filter(
      (t) => t.amount < 0 && (t.payee_name ?? "").toLowerCase().includes(q),
    );
    const byMonth: Record<string, number> = {};
    let total = 0;
    for (const t of matches) {
      const spent = -t.amount;
      total += spent;
      const month = t.date.slice(0, 7);
      byMonth[month] = (byMonth[month] ?? 0) + spent;
    }
    return {
      payee,
      budget: budget.name,
      currency: budget.currency_format?.iso_code ?? "",
      total: fromMilliunits(total),
      transactionCount: matches.length,
      byMonth: Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount: fromMilliunits(amount) })),
    };
  },
});

// SSE runtime with in-memory threads. The agent's LLM comes from a provider key.
// (We tried CopilotKit Intelligence via COPILOT_KIT_SECRET, but thread init
// requires a license — "Failed to initialize thread" — so we use the simple,
// reliable SSE path. Intelligence/durable threads can be revisited later.)
//
// Built lazily and cached so a missing env var can't break `next build`
// (route modules are imported at build time; construction only runs on request).
let handler: ((req: Request) => Response | Promise<Response>) | null = null;

// Pick the model + provider key. Precedence:
//   1. COPILOTKIT_MODEL override (e.g. "anthropic/claude-sonnet-4.5")
//   2. ANTHROPIC_API_KEY present -> Claude
//   3. OPENAI_API_KEY present    -> GPT
// NOTE: this CopilotKit version passes the model id straight to the AI SDK, so
// use the AI SDK's dash-form ids (e.g. claude-sonnet-4-6), NOT the dotted
// "claude-sonnet-4.5" the CopilotKit docs show (Anthropic rejects that string).
function resolveModel(): { model: string; apiKey?: string } {
  if (process.env.COPILOTKIT_MODEL) return { model: process.env.COPILOTKIT_MODEL };
  // Haiku 4.5: cheap for testing. Bump to claude-sonnet-4-6 via COPILOTKIT_MODEL.
  if (process.env.ANTHROPIC_API_KEY)
    return { model: "anthropic/claude-haiku-4-5", apiKey: process.env.ANTHROPIC_API_KEY };
  if (process.env.OPENAI_API_KEY)
    return { model: "openai/gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY };
  // No key set: still construct (build-safe); runs will error until a key exists.
  return { model: "anthropic/claude-haiku-4-5" };
}

function getHandler() {
  if (handler) return handler;

  const { model, apiKey } = resolveModel();

  const copilotRuntime = new CopilotRuntime({
    agents: {
      default: new BuiltInAgent({
        model,
        apiKey,
        maxSteps: 5,
        tools: [
          listBudgets,
          getSpendingByPayee,
          getSpendingByCategory,
          getBudgetOverview,
        ],
        prompt:
          "You are a helpful budgeting assistant for YNAB. The user may have " +
          "multiple budgets; if they mention one by name, pass it as budgetName, " +
          "and use listBudgets to discover names. To answer questions " +
          "about spending at a merchant, call getSpendingByPayee, then render " +
          "the spendOverTimeChart component using its `byMonth` array as " +
          "`points` and its `currency`, and give a short summary of the total. " +
          "For a category breakdown, call getSpendingByCategory, then render " +
          "categoryPieChart with its `slices` (if the user asks to combine " +
          "categories, sum the relevant slices first). For account balances or " +
          "budget overviews, call getBudgetOverview then render budgetCard with " +
          "its `accounts` and `currency`. When the user wants to plan a " +
          "trip or savings goal, generate sensible categories with suggested " +
          "amounts and render planCard (a suggestion, not written to YNAB).",
      }),
    },
    runner: new InMemoryAgentRunner(),
  });

  const app = createCopilotHonoHandler({
    runtime: copilotRuntime,
    basePath: "/api/copilotkit",
  });

  handler = handle(app);
  return handler;
}

export function GET(req: NextRequest) {
  return getHandler()(req);
}
export async function POST(req: NextRequest) {
  // Read the YNAB token here (route-handler scope can access cookies), then
  // make it available to tool execution via AsyncLocalStorage.
  const token = await getValidAccessToken();
  return tokenStore.run(token, () => getHandler()(req)) as
    | Response
    | Promise<Response>;
}
export function PATCH(req: NextRequest) {
  return getHandler()(req);
}
export function DELETE(req: NextRequest) {
  return getHandler()(req);
}
