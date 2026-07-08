"use client";

import { useEffect, useRef, useState } from "react";
import { useCopilotKit } from "@copilotkit/react-core/v2";
import {
  BYOK_MODELS,
  ByokConfig,
  DEFAULT_BYOK_MODEL,
  LLM_KEY_HEADER,
  LLM_MODEL_HEADER,
  clearByok,
  setByok,
} from "@/lib/byok";

// Mask a key for display: keep the sk-ant- prefix + last 4 chars.
function mask(key: string): string {
  if (key.length <= 12) return "••••";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

interface ByokSettingsProps {
  /** Current saved config, lifted to the parent so it can gate the chat on it. */
  value: ByokConfig | null;
  onChange: (cfg: ByokConfig | null) => void;
}

/**
 * Bring-your-own-key panel (Phase 9). Lets the user enter their own Anthropic
 * API key + pick a model so they pay for their own LLM usage. Saves to
 * sessionStorage and pushes the key to the runtime imperatively via
 * `copilotkit.setHeaders` so it takes effect on the very next message (the
 * provider's function-form `headers` only re-reads on re-render).
 */
export function ByokSettings({ value: saved, onChange }: ByokSettingsProps) {
  const { copilotkit } = useCopilotKit();
  const [open, setOpen] = useState(false);
  const [draftKey, setDraftKey] = useState("");
  const [model, setModel] = useState(saved?.model ?? DEFAULT_BYOK_MODEL);
  const panelRef = useRef<HTMLDivElement>(null);

  // Keep the model select in sync when the saved config changes externally.
  useEffect(() => {
    if (saved) setModel(saved.model);
  }, [saved]);

  // Close the panel on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function applyHeaders(apiKey: string | null, m: string | null) {
    // setHeaders is an overwrite; null values are dropped (clears the header).
    copilotkit.setHeaders({
      ...copilotkit.headers,
      [LLM_KEY_HEADER]: apiKey,
      [LLM_MODEL_HEADER]: m,
    });
  }

  function handleSave() {
    const key = draftKey.trim();
    if (!key) return;
    setByok(key, model);
    applyHeaders(key, model);
    onChange({ apiKey: key, model });
    setDraftKey("");
    setOpen(false);
  }

  // Changing the model while a key is already saved should take effect too.
  function handleModelChange(m: string) {
    setModel(m);
    if (saved) {
      setByok(saved.apiKey, m);
      applyHeaders(saved.apiKey, m);
      onChange({ ...saved, model: m });
    }
  }

  function handleClear() {
    clearByok();
    applyHeaders(null, null);
    onChange(null);
    setDraftKey("");
    setModel(DEFAULT_BYOK_MODEL);
  }

  return (
    <div className="byok" ref={panelRef}>
      <button
        type="button"
        className="button byok-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={saved ? "Using your own API key" : "Use your own API key"}
      >
        🔑 {saved ? "Your key" : "API key"}
      </button>

      {open && (
        <div className="byok-panel" role="dialog" aria-label="LLM API key">
          <p className="byok-title">Bring your own Anthropic key</p>
          <p className="byok-note">
            Your key is stored only in this tab (sessionStorage), sent to this
            app&apos;s runtime per request, and cleared on logout. Usage is
            billed to your Anthropic account.
          </p>

          {saved ? (
            <p className="byok-status">
              Active: <code>{mask(saved.apiKey)}</code>
            </p>
          ) : null}

          <label className="byok-field">
            Model
            <select
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {BYOK_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.hint ? ` — ${m.hint}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="byok-field">
            {saved ? "Replace key" : "API key"}
            <input
              type="password"
              autoComplete="off"
              placeholder="sk-ant-…"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </label>

          <div className="byok-actions">
            <button
              type="button"
              className="button"
              onClick={handleSave}
              disabled={!draftKey.trim()}
            >
              Save
            </button>
            {saved ? (
              <button type="button" className="button" onClick={handleClear}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
