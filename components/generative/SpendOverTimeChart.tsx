"use client";

import { z } from "zod";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// Maps directly onto getSpendingByPayee's `byMonth` output.
export const SpendOverTimeChartProps = z.object({
  title: z.string().describe("Chart title, e.g. 'Panda Express spending'"),
  currency: z.string().optional().describe("ISO currency code, e.g. USD"),
  points: z
    .array(
      z.object({
        month: z.string().describe("Month label, e.g. '2026-03'"),
        amount: z.number().describe("Amount spent that month (major units)"),
      }),
    )
    .describe("One point per month, chronological"),
});

export type SpendOverTimeChartProps = z.infer<typeof SpendOverTimeChartProps>;

export function SpendOverTimeChart({
  title,
  currency,
  points,
}: SpendOverTimeChartProps) {
  const data = points ?? [];
  const total = data.reduce((sum, p) => sum + p.amount, 0);
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="gen-card">
      <div className="gen-card-title">{title}</div>
      {data.length === 0 ? (
        <p className="gen-empty">No spending to show.</p>
      ) : (
        <>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="color-mix(in srgb, currentColor 12%, transparent)"
                />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={48} />
                <Tooltip formatter={(value) => fmt(Number(value))} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="gen-total">
            <span>Total</span>
            <span>
              {fmt(total)} {currency ?? ""}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
