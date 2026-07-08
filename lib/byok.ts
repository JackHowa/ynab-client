// Bring-your-own-key (Phase 9). Lets each user supply their own Anthropic API
// key + pick a model so they pay for their own LLM usage instead of the app
// owner footing everyone's bill.
//
// Trust model: the key is stored ONLY in sessionStorage (cleared when the tab
// closes or on logout — see app/page.tsx) and sent to our OWN runtime
// (/api/copilotkit) as a request header. It is never persisted to a cookie or
// localStorage, never committed, and never logged server-side. The runtime uses
// it in-memory to construct the agent and does not store it. This mirrors how
// the YNAB access token is handled.
//
// No server-only deps here so both the client (settings UI, provider) and the
// route handler can import the shared constants.

/** Per-request header carrying the user's LLM API key. */
export const LLM_KEY_HEADER = "x-llm-api-key";
/** Per-request header carrying the user's chosen model id. */
export const LLM_MODEL_HEADER = "x-llm-model";

const STORAGE_KEY = "byok:apiKey";
const STORAGE_MODEL = "byok:model";

export interface ByokModel {
  /** AI SDK dash-form model id passed straight to the runtime. */
  id: string;
  label: string;
  hint?: string;
}

// Only ids already proven against this CopilotKit/AI SDK version. The runtime
// passes the id straight to the AI SDK, which rejects the dotted docs form
// (e.g. "claude-sonnet-4.5") — use the dash form. Do NOT add ids from memory.
export const BYOK_MODELS: ByokModel[] = [
  {
    id: "anthropic/claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    hint: "Fast & cheap",
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    hint: "Most capable",
  },
];

export const DEFAULT_BYOK_MODEL = BYOK_MODELS[0].id;

export interface ByokConfig {
  apiKey: string;
  model: string;
}

/** Read the stored key + model (client only). Returns null if no key is set. */
export function getByok(): ByokConfig | null {
  if (typeof window === "undefined") return null;
  const apiKey = window.sessionStorage.getItem(STORAGE_KEY);
  if (!apiKey) return null;
  return {
    apiKey,
    model: window.sessionStorage.getItem(STORAGE_MODEL) || DEFAULT_BYOK_MODEL,
  };
}

/** Persist the key + model to sessionStorage (client only). */
export function setByok(apiKey: string, model: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, apiKey.trim());
  window.sessionStorage.setItem(STORAGE_MODEL, model);
}

/** Remove the stored key + model (client only). Call on logout. */
export function clearByok(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(STORAGE_MODEL);
}

/**
 * Build the header set from the stored key. Used to seed the CopilotKit
 * provider at mount (so a key survives a page reload). Returns an empty object
 * when no key is set, so requests fall back to the server key if the runtime
 * allows it.
 */
export function byokHeaders(): Record<string, string> {
  const cfg = getByok();
  if (!cfg) return {};
  return { [LLM_KEY_HEADER]: cfg.apiKey, [LLM_MODEL_HEADER]: cfg.model };
}
