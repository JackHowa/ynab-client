"use client";

import { z } from "zod";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Zod schema doubles as the type definition AND the `useComponent` parameters
// contract, so the agent passes validated args straight into the component.
export const CategoryPieChartProps = z.object({
  title: z.string().describe("Chart title, e.g. 'Spending by category'"),
  slices: z
    .array(
      z.object({
        name: z.string().describe("Category name"),
        value: z.number().describe("Amount for this category (major units)"),
      }),
    )
    .describe("One slice per category"),
});

export type CategoryPieChartProps = z.infer<typeof CategoryPieChartProps>;

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

export function CategoryPieChart({ title, slices }: CategoryPieChartProps) {
  const data = (slices ?? []).filter((s) => s.value > 0);

  return (
    <div className="gen-card">
      <div className="gen-card-title">{title}</div>
      {data.length === 0 ? (
        <p className="gen-empty">No spending to show.</p>
      ) : (
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <RePieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(entry) => entry.name}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  Number(value).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                }
              />
              <Legend />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
