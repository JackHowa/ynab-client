"use client";

import { useEffect, useState } from "react";
import { useCopilotKit } from "@copilotkit/react-core/v2";
import { BUDGET_HEADER, clearSelectedBudget, setSelectedBudget } from "@/lib/budget";

interface BudgetSelectorProps {
  /** Lifted to the parent so it can key the chat and force a fresh thread. */
  value: string;
  onChange: (name: string) => void;
}

/**
 * Lets the user pick which YNAB budget the assistant should focus on,
 * instead of the model having to guess (or juggle across all budgets) on
 * every question. Selection is saved to sessionStorage and pushed to the
 * runtime imperatively via `copilotkit.setHeaders` so it takes effect on the
 * very next message (see lib/budget for the header contract).
 *
 * Hidden when there's nothing to disambiguate (0 or 1 budget).
 */
export function BudgetSelector({ value: selected, onChange }: BudgetSelectorProps) {
  const { copilotkit } = useCopilotKit();
  const [budgets, setBudgets] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/budgets")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const names = (body?.budgets ?? []).map((b: { name: string }) => b.name);
        setBudgets(names);
      })
      .catch(() => {});
  }, []);

  function handleChange(name: string) {
    if (name) setSelectedBudget(name);
    else clearSelectedBudget();
    copilotkit.setHeaders({
      ...copilotkit.headers,
      [BUDGET_HEADER]: name || null,
    });
    onChange(name);
  }

  if (budgets.length < 2) return null;

  return (
    <label>
      Budget:{" "}
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="budget-select"
      >
        <option value="">All budgets</option>
        {budgets.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
