"use client";

import { useEffect, useState } from "react";
import { CopilotChat, useComponent } from "@copilotkit/react-core/v2";
import {
  CategoryPieChart,
  CategoryPieChartProps,
} from "@/components/generative/CategoryPieChart";
import { BudgetCard, BudgetCardProps } from "@/components/generative/BudgetCard";
import {
  SpendOverTimeChart,
  SpendOverTimeChartProps,
} from "@/components/generative/SpendOverTimeChart";
import { PlanCard, PlanCardProps } from "@/components/generative/PlanCard";

/** The assistant chat with all generative-UI components registered. */
export function AssistantChat() {
  // Match CopilotKit's chat theme to the system color scheme.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setIsDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useComponent({
    name: "spendOverTimeChart",
    description:
      "Bar chart of money spent over time (by month). Use after calling " +
      "getSpendingByPayee — pass its `byMonth` array as `points` and its " +
      "`currency`.",
    parameters: SpendOverTimeChartProps,
    render: SpendOverTimeChart,
  });

  useComponent({
    name: "categoryPieChart",
    description:
      "Pie chart of spending distribution by category. Use after " +
      "getSpendingByCategory; pass its `slices`.",
    parameters: CategoryPieChartProps,
    render: CategoryPieChart,
  });

  useComponent({
    name: "planCard",
    description:
      "An editable suggested budget plan (categories + amounts) for a goal or " +
      "trip, e.g. 'plan a trip to Norway'. A suggestion only (not written to YNAB).",
    parameters: PlanCardProps,
    render: PlanCard,
  });

  useComponent({
    name: "budgetCard",
    description:
      "A budget's accounts and balances with a total. Use after getBudgetOverview.",
    parameters: BudgetCardProps,
    render: BudgetCard,
  });

  return (
    <div className={`chat-window${isDark ? " dark" : ""}`}>
      <CopilotChat />
    </div>
  );
}
