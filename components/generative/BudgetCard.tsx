"use client";

import { z } from "zod";

export const BudgetCardProps = z.object({
  budgetName: z.string().describe("Name of the budget"),
  currency: z.string().optional().describe("ISO currency code, e.g. USD"),
  accounts: z
    .array(
      z.object({
        name: z.string().describe("Account name"),
        balance: z.number().describe("Account balance in major units"),
      }),
    )
    .describe("Accounts in this budget"),
});

export type BudgetCardProps = z.infer<typeof BudgetCardProps>;

export function BudgetCard({ budgetName, currency, accounts }: BudgetCardProps) {
  const rows = accounts ?? [];
  const total = rows.reduce((sum, a) => sum + a.balance, 0);
  const fmt = (n: number) =>
    `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${
      currency ? ` ${currency}` : ""
    }`;

  return (
    <div className="gen-card">
      <div className="gen-card-title">{budgetName}</div>
      <ul className="gen-rows">
        {rows.map((a, i) => (
          <li key={i}>
            <span>{a.name}</span>
            <span>{fmt(a.balance)}</span>
          </li>
        ))}
      </ul>
      <div className="gen-total">
        <span>Total</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
}
