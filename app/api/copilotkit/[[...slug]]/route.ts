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
import { CHAT_MODES } from "@/lib/modes";
import {
  DEFAULT_BYOK_MODEL,
  LLM_KEY_HEADER,
  LLM_MODEL_HEADER,
} from "@/lib/byok";
import { BUDGET_HEADER } from "@/lib/budget";
import {
  DEMO_BUDGET,
  DEMO_TRANSACTIONS,
  DEMO_ACCOUNTS,
  filterSince,
} from "@/lib/demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Carries the current request's YNAB access token + selected budget into
// server-side tool execution (tools don't receive the request, so we seed
// this per-request).
interface RequestContext {
  token: string | null;
  selectedBudget: string | null;
}
const requestStore = new AsyncLocalStorage<RequestContext>();

type LoadResult =
  | { budget: Budget; transactions: Transaction[] }
  | { error: string };

// Demo data is the fallback whenever there's no connected YNAB account (no
// token) so the assistant is usable immediately, without setup. DEMO_MODE=1
// forces it even when connected (useful for screenshots/demos).
function shouldUseDemo(): boolean {
  return process.env.DEMO_MODE === "1" || !requestStore.getStore()?.token;
}

// Single data source for the tools: demo -> fabricated data; otherwise the
// connected YNAB budget.
// budgetName: match a specific budget (partial, case-insensitive). When omitted,
// uses the most-recently-modified budget (not always budgets[0]).
async function loadData(opts: {
  budgetName?: string;
  sinceDate?: string;
}): Promise<LoadResult> {
  if (shouldUseDemo()) {
    return {
      budget: DEMO_BUDGET,
      transactions: filterSince(DEMO_TRANSACTIONS, opts.sinceDate),
    };
  }
  const ynab = new YnabClient(requestStore.getStore()!.token!);
  const budgets = await ynab.getBudgets();
  if (budgets.length === 0) return { error: "No budgets found." };

  const selected = selectBudget(budgets, opts.budgetName);
  if ("error" in selected) return selected;
  const transactions = await ynab.getTransactions(selected.budget.id, opts.sinceDate);
  return { budget: selected.budget, transactions };
}

// Choose a budget by name (partial), falling back to the user's dropdown
// selection, then to the most-recently-modified budget.
function selectBudget(
  budgets: Budget[],
  budgetName?: string,
): { budget: Budget } | { error: string } {
  const name = budgetName || requestStore.getStore()?.selectedBudget || undefined;
  if (name) {
    const q = name.toLowerCase();
    const match = budgets.find((b) => b.name.toLowerCase().includes(q));
    if (!match)
      return {
        error: `No budget matching "${name}". Available: ${budgets
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

// Resolve a connected YnabClient + selected budget (real mode only).
async function resolveBudget(
  budgetName?: string,
): Promise<{ ynab: YnabClient; budget: Budget } | { error: string }> {
  const token = requestStore.getStore()?.token;
  if (!token) return { error: "Not connected to YNAB." };
  const ynab = new YnabClient(token);
  const budgets = await ynab.getBudgets();
  if (budgets.length === 0) return { error: "No budgets found." };
  const selected = selectBudget(budgets, budgetName);
  if ("error" in selected) return selected;
  return { ynab, budget: selected.budget };
}

const getCategoryBudgets = defineTool({
  name: "getCategoryBudgets",
  description:
    "This month's budget per category: budgeted vs spent vs remaining. Use for " +
    "'am I over on Dining?' or budget-vs-actual questions.",
  parameters: z.object({
    budgetName: z
      .string()
      .optional()
      .describe("Which budget. Defaults to the user's selected budget, else the most recent."),
  }),
  execute: async ({ budgetName }) => {
    if (shouldUseDemo()) {
      const spent: Record<string, number> = {};
      for (const t of DEMO_TRANSACTIONS) {
        if (t.amount >= 0) continue;
        const n = t.category_name ?? "Uncategorized";
        spent[n] = (spent[n] ?? 0) + -t.amount;
      }
      return {
        budget: DEMO_BUDGET.name,
        currency: "USD",
        categories: Object.entries(spent)
          .map(([name, s]) => {
            const budgeted = Math.ceil((s * 1.15) / 10000) * 10000;
            return {
              name,
              budgeted: fromMilliunits(budgeted),
              spent: fromMilliunits(s),
              remaining: fromMilliunits(budgeted - s),
            };
          })
          .sort((a, b) => b.spent - a.spent),
      };
    }
    const r = await resolveBudget(budgetName);
    if ("error" in r) return r;
    const cats = await r.ynab.getCategories(r.budget.id);
    return {
      budget: r.budget.name,
      currency: r.budget.currency_format?.iso_code ?? "",
      categories: cats.map((c) => ({
        name: c.name,
        group: c.category_group_name,
        budgeted: fromMilliunits(c.budgeted),
        spent: fromMilliunits(-c.activity),
        remaining: fromMilliunits(c.balance),
      })),
    };
  },
});

const getMonthSummary = defineTool({
  name: "getMonthSummary",
  description:
    "Summary for a month: income, budgeted, spent, to-be-budgeted, age of " +
    "money. Use for 'how's this month looking?'.",
  parameters: z.object({
    budgetName: z
      .string()
      .optional()
      .describe("Which budget. Defaults to the user's selected budget, else the most recent."),
    month: z
      .string()
      .optional()
      .describe("Month as YYYY-MM-01, or 'current' (default)."),
  }),
  execute: async ({ budgetName, month }) => {
    if (shouldUseDemo()) {
      const latest = "2026-06";
      const activity = DEMO_TRANSACTIONS.filter((t) => t.date.startsWith(latest)).reduce(
        (s, t) => s + t.amount,
        0,
      );
      const income = 5200_000;
      return {
        month: `${latest}-01`,
        income: fromMilliunits(income),
        budgeted: fromMilliunits(-activity),
        spent: fromMilliunits(-activity),
        toBeBudgeted: fromMilliunits(income + activity),
        ageOfMoney: 28,
        currency: "USD",
      };
    }
    const r = await resolveBudget(budgetName);
    if ("error" in r) return r;
    const m = await r.ynab.getMonth(r.budget.id, month ?? "current");
    return {
      month: m.month,
      income: fromMilliunits(m.income),
      budgeted: fromMilliunits(m.budgeted),
      spent: fromMilliunits(-m.activity),
      toBeBudgeted: fromMilliunits(m.to_be_budgeted),
      ageOfMoney: m.age_of_money,
      currency: r.budget.currency_format?.iso_code ?? "",
    };
  },
});

const getBudgetOverview = defineTool({
  name: "getBudgetOverview",
  description:
    "Get a budget's open accounts and balances. Use before rendering " +
    "budgetCard for account-balance / budget-overview questions.",
  parameters: z.object({
    budgetName: z
      .string()
      .optional()
      .describe("Which budget (name, partial ok). Defaults to the user's selected budget, else the most recent."),
  }),
  execute: async ({ budgetName }) => {
    if (shouldUseDemo()) {
      return {
        budgetName: DEMO_BUDGET.name,
        currency: DEMO_BUDGET.currency_format?.iso_code ?? "",
        accounts: DEMO_ACCOUNTS.filter((a) => !a.closed).map((a) => ({
          name: a.name,
          balance: fromMilliunits(a.balance),
        })),
      };
    }
    const ynab = new YnabClient(requestStore.getStore()!.token!);
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
    if (shouldUseDemo()) return { budgets: [DEMO_BUDGET.name] };
    const ynab = new YnabClient(requestStore.getStore()!.token!);
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
      .describe("Which budget (name, partial ok). Defaults to the user's selected budget, else the most recent."),
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

const queryTransactions = defineTool({
  name: "queryTransactions",
  description:
    "List/filter transactions from a budget by payee, category, date, and/or " +
    "minimum amount. Returns matching transactions + a total. Use for ad-hoc " +
    "questions like 'transactions over $100 last month' or 'recent groceries'.",
  parameters: z.object({
    budgetName: z
      .string()
      .optional()
      .describe("Which budget (name, partial ok). Defaults to the user's selected budget, else the most recent."),
    payee: z.string().optional().describe("Filter by payee substring"),
    category: z.string().optional().describe("Filter by category substring"),
    sinceDate: z
      .string()
      .optional()
      .describe("Only transactions on/after this ISO date (YYYY-MM-DD)"),
    minAmount: z
      .number()
      .optional()
      .describe("Minimum spend amount (major units, absolute)"),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 50)"),
  }),
  execute: async ({ budgetName, payee, category, sinceDate, minAmount, limit }) => {
    const loaded = await loadData({ budgetName, sinceDate });
    if ("error" in loaded) return loaded;
    const { budget, transactions } = loaded;
    const p = payee?.toLowerCase();
    const c = category?.toLowerCase();
    let matches = transactions.filter((t) => t.amount < 0);
    if (p) matches = matches.filter((t) => (t.payee_name ?? "").toLowerCase().includes(p));
    if (c) matches = matches.filter((t) => (t.category_name ?? "").toLowerCase().includes(c));
    if (minAmount != null) matches = matches.filter((t) => -t.amount / 1000 >= minAmount);
    const total = matches.reduce((s, t) => s + -t.amount, 0);
    return {
      budget: budget.name,
      currency: budget.currency_format?.iso_code ?? "",
      total: fromMilliunits(total),
      count: matches.length,
      transactions: matches.slice(0, limit ?? 50).map((t) => ({
        date: t.date,
        payee: t.payee_name,
        category: t.category_name,
        amount: fromMilliunits(-t.amount),
      })),
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
      .describe("Which budget (name, partial ok). Defaults to the user's selected budget, else the most recent."),
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
// Bring-your-own-key (Phase 9): each request may carry the user's own Anthropic
// key + model via headers (see lib/byok), so users pay for their own LLM usage.
// Handlers are therefore built PER (model, apiKey) — a single cached handler
// would bake in whoever's key arrived first. Cached in a bounded Map so repeated
// requests from the same user reuse the same runtime. Construction only runs on
// request (never at build/import), so a missing env var can't break `next build`.
const MAX_HANDLERS = 25;
const handlers = new Map<
  string,
  (req: Request) => Response | Promise<Response>
>();

// Pick the model + provider key. Precedence:
//   1. User's own key from the request header (BYOK) -> user pays
//   2. Server fallback (unless ALLOW_SERVER_LLM_KEY="0"): COPILOTKIT_MODEL
//      override, else ANTHROPIC_API_KEY -> Claude, else OPENAI_API_KEY -> GPT
//   3. No key: still construct (build-safe); runs error until a key exists,
//      prompting the user to add one in the API-key panel.
// NOTE: this CopilotKit version passes the model id straight to the AI SDK, so
// use the AI SDK's dash-form ids (e.g. claude-sonnet-4-6), NOT the dotted
// "claude-sonnet-4.5" the CopilotKit docs show (Anthropic rejects that string).
function resolveModel(req: Request): { model: string; apiKey?: string } {
  const userKey = req.headers.get(LLM_KEY_HEADER)?.trim();
  if (userKey) {
    const userModel = req.headers.get(LLM_MODEL_HEADER)?.trim();
    return { model: userModel || DEFAULT_BYOK_MODEL, apiKey: userKey };
  }
  // Server fallback keeps the deployed app working for users who haven't
  // supplied a key. Set ALLOW_SERVER_LLM_KEY=0 to require BYOK (strict billing).
  const allowServerKey = process.env.ALLOW_SERVER_LLM_KEY !== "0";
  if (allowServerKey) {
    if (process.env.COPILOTKIT_MODEL) return { model: process.env.COPILOTKIT_MODEL };
    if (process.env.ANTHROPIC_API_KEY)
      return { model: DEFAULT_BYOK_MODEL, apiKey: process.env.ANTHROPIC_API_KEY };
    if (process.env.OPENAI_API_KEY)
      return { model: "openai/gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY };
  }
  // No key available: construct anyway (build-safe); runs will error clearly.
  return { model: DEFAULT_BYOK_MODEL };
}

// Resolve the per-request key/model and return a cached handler built for it.
function handlerFor(req: Request) {
  const { model, apiKey } = resolveModel(req);
  // Cache key: model + apiKey. A space can't appear in a model id or API key.
  const cacheKey = `${model} ${apiKey ?? ""}`;
  const existing = handlers.get(cacheKey);
  if (existing) return existing;

  const built = buildHandler(model, apiKey);
  // Bound the cache (simple FIFO eviction) so distinct keys can't grow it forever.
  if (handlers.size >= MAX_HANDLERS) {
    const oldest = handlers.keys().next().value;
    if (oldest !== undefined) handlers.delete(oldest);
  }
  handlers.set(cacheKey, built);
  return built;
}

function buildHandler(model: string, apiKey?: string) {
  const TOOLS = [
    listBudgets,
    getSpendingByPayee,
    getSpendingByCategory,
    getBudgetOverview,
    queryTransactions,
    getCategoryBudgets,
    getMonthSummary,
  ];

  const BASE_PROMPT =
    "You are a budgeting assistant for YNAB. The user may have multiple " +
    "budgets; if they mention one by name, pass it as budgetName, and use " +
    "listBudgets to discover names. To answer questions about spending at a " +
    "merchant, call getSpendingByPayee, then render the spendOverTimeChart " +
    "component using its `byMonth` array as `points` and its `currency`. For a " +
    "category breakdown, call getSpendingByCategory, then render categoryPieChart " +
    "with its `slices` (to combine categories, sum the relevant slices first). " +
    "For account balances, call getBudgetOverview then render budgetCard. For " +
    "budget-vs-actual use getCategoryBudgets; for 'how's this month' use " +
    "getMonthSummary. To plan a trip or goal, render planCard (a suggestion, " +
    "not written to YNAB).";

  // One agent per selectable mode/personality. The frontend picks via agentId.
  const agents = Object.fromEntries(
    CHAT_MODES.map((m) => [
      m.id,
      new BuiltInAgent({
        model,
        apiKey,
        maxSteps: 5,
        tools: TOOLS,
        prompt: `${BASE_PROMPT}\n\nPERSONA — answer in this voice: ${m.persona}`,
      }),
    ]),
  );

  const copilotRuntime = new CopilotRuntime({
    agents,
    runner: new InMemoryAgentRunner(),
    // Enable A2UI so the agent can compose open-ended declarative UI (beyond
    // the registered components). /info advertises A2UI; the client renderer
    // auto-mounts when the provider sets the a2ui prop.
    a2ui: {},
  });

  const app = createCopilotHonoHandler({
    runtime: copilotRuntime,
    basePath: "/api/copilotkit",
  });

  return handle(app);
}

export function GET(req: NextRequest) {
  return handlerFor(req)(req);
}
export async function POST(req: NextRequest) {
  // Read the YNAB token here (route-handler scope can access cookies), then
  // make it + the selected-budget header available to tool execution via
  // AsyncLocalStorage.
  const token = await getValidAccessToken();
  const selectedBudget = req.headers.get(BUDGET_HEADER)?.trim() || null;
  return requestStore.run({ token, selectedBudget }, () => handlerFor(req)(req)) as
    | Response
    | Promise<Response>;
}
export function PATCH(req: NextRequest) {
  return handlerFor(req)(req);
}
export function DELETE(req: NextRequest) {
  return handlerFor(req)(req);
}
