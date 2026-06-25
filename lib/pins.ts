"use client";

// Persist hand-picked generative charts to localStorage so they can be
// re-rendered on the dashboard. Each pin is just the component name + its args.

export interface Pin {
  id: string;
  name: string; // generative component/tool name (see registry)
  args: Record<string, unknown>;
  savedAt: number;
}

const KEY = "ynab-dashboard-pins";

export function getPins(): Pin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Pin[]) : [];
  } catch {
    return [];
  }
}

function write(pins: Pin[]) {
  window.localStorage.setItem(KEY, JSON.stringify(pins));
  // Notify same-tab listeners (the storage event only fires cross-tab).
  window.dispatchEvent(new Event("ynab-pins-changed"));
}

export function addPin(name: string, args: Record<string, unknown>): void {
  const now = Date.now();
  const id = `${name}-${now}`;
  write([...getPins(), { id, name, args, savedAt: now }]);
}

export function removePin(id: string): void {
  write(getPins().filter((p) => p.id !== id));
}
