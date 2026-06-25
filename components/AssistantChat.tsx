"use client";

import { useEffect, useState } from "react";
import {
  CopilotChat,
  useFrontendTool,
  useConfigureSuggestions,
} from "@copilotkit/react-core/v2";
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
import { Pinnable } from "@/components/Pinnable";

// Render components are registered as frontend tools that return a small ack
// result (not render-only): a render-only tool emits a tool call with no
// TOOL_CALL_RESULT, leaving a dangling tool_use in the thread that breaks the
// NEXT message (INCOMPLETE_STREAM "Tool result is missing"). The ack keeps the
// conversation history valid across turns.
const ack = async () => ({ ok: true });

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

  // Starter prompts shown as clickable pills before the first message.
  useConfigureSuggestions({
    available: "before-first-message",
    suggestions: [
      {
        title: "Spending by category",
        message: "Show my spending by category as a pie chart.",
      },
      {
        title: "A merchant over time",
        message: "How much have I spent at Panda Express over time?",
      },
      { title: "How's this month?", message: "How is this month looking?" },
      { title: "Plan a trip", message: "Plan a budget for a trip to Norway." },
    ],
  });

  useFrontendTool({
    name: "spendOverTimeChart",
    description:
      "Bar chart of money spent over time (by month). Use after calling " +
      "getSpendingByPayee — pass its `byMonth` array as `points` and its `currency`.",
    parameters: SpendOverTimeChartProps,
    handler: ack,
    render: ({ args }) => (
      <Pinnable name="spendOverTimeChart" args={args as Record<string, unknown>}>
        <SpendOverTimeChart {...(args as SpendOverTimeChartProps)} />
      </Pinnable>
    ),
  });

  useFrontendTool({
    name: "categoryPieChart",
    description:
      "Pie chart of spending distribution by category. Use after " +
      "getSpendingByCategory; pass its `slices`.",
    parameters: CategoryPieChartProps,
    handler: ack,
    render: ({ args }) => (
      <Pinnable name="categoryPieChart" args={args as Record<string, unknown>}>
        <CategoryPieChart {...(args as CategoryPieChartProps)} />
      </Pinnable>
    ),
  });

  useFrontendTool({
    name: "planCard",
    description:
      "An editable suggested budget plan (categories + amounts) for a goal or " +
      "trip, e.g. 'plan a trip to Norway'. A suggestion only (not written to YNAB).",
    parameters: PlanCardProps,
    handler: ack,
    render: ({ args }) => (
      <Pinnable name="planCard" args={args as Record<string, unknown>}>
        <PlanCard {...(args as PlanCardProps)} />
      </Pinnable>
    ),
  });

  useFrontendTool({
    name: "budgetCard",
    description:
      "A budget's accounts and balances with a total. Use after getBudgetOverview.",
    parameters: BudgetCardProps,
    handler: ack,
    render: ({ args }) => (
      <Pinnable name="budgetCard" args={args as Record<string, unknown>}>
        <BudgetCard {...(args as BudgetCardProps)} />
      </Pinnable>
    ),
  });

  return (
    <div className={`chat-window${isDark ? " dark" : ""}`}>
      <CopilotChat />
    </div>
  );
}
