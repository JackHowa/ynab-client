"use client";

import { useState } from "react";
import { z } from "zod";

// The agent generates a suggested budget (categories + amounts). Read-only with
// respect to YNAB — this is a planning suggestion, not written back to a budget.
export const PlanCardProps = z.object({
  title: z.string().describe("Plan title, e.g. 'Trip to Norway'"),
  currency: z.string().optional().describe("ISO currency code, e.g. USD"),
  items: z
    .array(
      z.object({
        category: z.string().describe("Category name, e.g. 'Flights'"),
        amount: z.number().describe("Suggested amount (major units)"),
        note: z.string().optional().describe("Short rationale"),
      }),
    )
    .describe("Suggested categories with amounts"),
});

export type PlanCardProps = z.infer<typeof PlanCardProps>;

export function PlanCard({ title, currency, items }: PlanCardProps) {
  // Amounts are editable locally so the user can tweak the suggestion.
  const [amounts, setAmounts] = useState<number[]>(
    (items ?? []).map((i) => i.amount),
  );
  const total = amounts.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="gen-card">
      <div className="gen-card-title">{title}</div>
      <ul className="gen-rows">
        {(items ?? []).map((item, i) => (
          <li key={i} style={{ alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ flex: 1 }}>
              {item.category}
              {item.note ? (
                <em
                  style={{
                    display: "block",
                    fontSize: "0.85em",
                    opacity: 0.65,
                    fontStyle: "normal",
                  }}
                >
                  {item.note}
                </em>
              ) : null}
            </span>
            <input
              type="number"
              value={Number.isFinite(amounts[i]) ? amounts[i] : 0}
              onChange={(e) => {
                const next = [...amounts];
                next[i] = parseFloat(e.target.value);
                setAmounts(next);
              }}
              style={{
                width: 110,
                textAlign: "right",
                background: "transparent",
                color: "inherit",
                border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
                borderRadius: 6,
                padding: "0.2rem 0.4rem",
                font: "inherit",
              }}
            />
          </li>
        ))}
      </ul>
      <div className="gen-total">
        <span>Total</span>
        <span>
          {fmt(total)} {currency ?? ""}
        </span>
      </div>
    </div>
  );
}
