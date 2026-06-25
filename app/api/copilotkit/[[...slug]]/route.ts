import {
  CopilotRuntime,
  BuiltInAgent,
  InMemoryAgentRunner,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import { handle } from "hono/vercel";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (process.env.ANTHROPIC_API_KEY)
    return { model: "anthropic/claude-sonnet-4-6", apiKey: process.env.ANTHROPIC_API_KEY };
  if (process.env.OPENAI_API_KEY)
    return { model: "openai/gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY };
  // No key set: still construct (build-safe); runs will error until a key exists.
  return { model: "anthropic/claude-sonnet-4-6" };
}

function getHandler() {
  if (handler) return handler;

  const { model, apiKey } = resolveModel();

  const copilotRuntime = new CopilotRuntime({
    agents: {
      default: new BuiltInAgent({
        model,
        apiKey,
        prompt:
          "You are a helpful budgeting assistant for YNAB. When the user asks " +
          "to visualize spending, account balances, categories, or grouped " +
          "transactions, render the appropriate generative-UI component.",
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
export function POST(req: NextRequest) {
  return getHandler()(req);
}
export function PATCH(req: NextRequest) {
  return getHandler()(req);
}
export function DELETE(req: NextRequest) {
  return getHandler()(req);
}
