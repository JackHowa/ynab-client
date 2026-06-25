import {
  CopilotRuntime,
  CopilotKitIntelligence,
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

  const copilotRuntime = new CopilotRuntime({
    // The Intelligence cloud runs the agent; generative-UI components are
    // registered on the frontend via useComponent and exposed as tools.
    agents: {} as never,
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
