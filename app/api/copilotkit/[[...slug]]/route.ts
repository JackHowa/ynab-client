import {
  CopilotRuntime,
  CopilotKitIntelligence,
  BuiltInAgent,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import { handle } from "hono/vercel";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CopilotKit Intelligence (managed cloud) provides the model, so we don't need
// our own OpenAI/Anthropic key — just the CopilotKit secret as the apiKey.
//   COPILOT_KIT_SECRET -> Intelligence apiKey
//
// Built lazily and cached so a missing env var can't break `next build`
// (route modules are imported at build time; construction only runs on request).
let handler: ((req: Request) => Response | Promise<Response>) | null = null;

function getHandler() {
  if (handler) return handler;

  const apiKey =
    process.env.COPILOT_KIT_SECRET ??
    process.env.COPILOTKIT_INTELLIGENCE_API_KEY ??
    "";

  const intelligence = new CopilotKitIntelligence({
    apiUrl: "https://api.copilotkit.ai",
    wsUrl: "wss://api.copilotkit.ai",
    apiKey,
  });

  // The frontend's useAgent("default") requires a registered "default" agent.
  // BuiltInAgent provides the LLM; model is configurable and resolves its
  // provider key from env (e.g. openai/* -> OPENAI_API_KEY). Intelligence adds
  // durable threads on top (billed to the CopilotKit secret's quota).
  const copilotRuntime = new CopilotRuntime({
    agents: {
      default: new BuiltInAgent({
        model: process.env.COPILOTKIT_MODEL ?? "openai/gpt-4o-mini",
        prompt:
          "You are a helpful budgeting assistant for YNAB. When the user asks " +
          "to visualize spending, account balances, categories, or grouped " +
          "transactions, render the appropriate generative-UI component.",
      }),
    },
    intelligence,
    identifyUser: (request: Request) => {
      const id = request.headers.get("x-user-id") ?? "anonymous";
      return { id, name: id };
    },
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
