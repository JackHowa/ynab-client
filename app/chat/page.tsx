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

export default function ChatPage() {
  // Match CopilotKit's chat theme to the system color scheme (it uses a `.dark`
  // ancestor class for dark mode, which doesn't auto-follow prefers-color-scheme).
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setIsDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Register generative-UI components as tools the agent can render.
  // The agent passes validated args (the Zod schema) straight into the component.
  useComponent({
    name: "categoryPieChart",
    description:
      "Display a breakdown of spending by category as a pie chart. Use when the user asks to visualize where money went, spending distribution, or category breakdowns.",
    parameters: CategoryPieChartProps,
    render: CategoryPieChart,
  });

  useComponent({
    name: "spendOverTimeChart",
    description:
      "Bar chart of money spent over time (by month). Use after calling " +
      "getSpendingByPayee — pass its `byMonth` array as `points` and its " +
      "`currency`. Good for 'how much did I spend at X over time'.",
    parameters: SpendOverTimeChartProps,
    render: SpendOverTimeChart,
  });

  useComponent({
    name: "planCard",
    description:
      "An editable suggested budget plan (categories + amounts) for a goal or " +
      "trip, e.g. 'plan a trip to Norway'. Generate sensible categories and " +
      "amounts and render them here. This is a suggestion only (not written to YNAB).",
    parameters: PlanCardProps,
    render: PlanCard,
  });

  useComponent({
    name: "budgetCard",
    description:
      "Display a budget's accounts and their balances in a card with a total. Use when the user asks about account balances or a budget overview.",
    parameters: BudgetCardProps,
    render: BudgetCard,
  });

  return (
    <main className="chat-page">
      <header>
        <h1>YNAB Assistant</h1>
        <a className="button" href="/">
          ← Budgets
        </a>
      </header>
      <p className="chat-hint">
        Ask things like <em>“show my spending by category as a pie chart”</em> or{" "}
        <em>“give me a budget card for checking and savings”</em>.
      </p>
      {/* `dark` (toggled by system pref) switches CopilotKit's chat to dark mode. */}
      <div className={`chat-window${isDark ? " dark" : ""}`}>
        <CopilotChat />
      </div>
    </main>
  );
}
