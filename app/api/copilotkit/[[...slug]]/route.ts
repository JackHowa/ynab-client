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
import { YnabClient, fromMilliunits } from "@/lib/ynab";
import { getValidAccessToken } from "@/lib/server-ynab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Carries the current request's YNAB access token into server-side tool
// execution (tools don't receive the request, so we seed this per-request).
const tokenStore = new AsyncLocalStorage<string | null>();

async function loadBudgetTransactions(token: string, sinceDate?: string) {
  const ynab = new YnabClient(token);
  const budgets = await ynab.getBudgets();
  if (budgets.length === 0) return null;
  const budget = budgets[0];
  const transactions = await ynab.getTransactions(budget.id, sinceDate);
  return { budget, transactions };
}

const getSpendingByCategory = defineTool({
  name: "getSpendingByCategory",
  description:
    "Total spending grouped by category from the user's connected YNAB budget. " +
    "Returns one slice per category. To COMBINE categories (e.g. Dining + " +
    "Coffee), sum the relevant slice values yourself before rendering.",
  parameters: z.object({
    sinceDate: z
      .string()
      .optional()
      .describe("Only include transactions on/after this ISO date (YYYY-MM-DD)"),
  }),
  execute: async ({ sinceDate }) => {
    const token = tokenStore.getStore();
    if (!token)
      return {
        error:
          "Not connected to YNAB. Ask the user to connect their account on the home page.",
      };
    const loaded = await loadBudgetTransactions(token, sinceDate);
    if (!loaded) return { error: "No budgets found." };
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
    sinceDate: z
      .string()
      .optional()
      .describe("Only include transactions on/after this ISO date (YYYY-MM-DD)"),
  }),
  execute: async ({ payee, sinceDate }) => {
    const token = tokenStore.getStore();
    if (!token)
      return {
        error:
          "Not connected to YNAB. Ask the user to connect their account on the home page.",
      };
    const ynab = new YnabClient(token);
    const budgets = await ynab.getBudgets();
    if (budgets.length === 0) return { error: "No budgets found." };
    const budget = budgets[0];
    const txns = await ynab.getTransactions(budget.id, sinceDate);
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
        tools: [getSpendingByPayee, getSpendingByCategory],
        prompt:
          "You are a helpful budgeting assistant for YNAB. To answer questions " +
          "about spending at a merchant, call getSpendingByPayee, then render " +
          "the spendOverTimeChart component using its `byMonth` array as " +
          "`points` and its `currency`, and give a short summary of the total. " +
          "For a category breakdown, call getSpendingByCategory, then render " +
          "categoryPieChart with its `slices` (if the user asks to combine " +
          "categories, sum the relevant slices first). For account balances or " +
          "budget overviews, render budgetCard.",
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
