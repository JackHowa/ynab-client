"use client";

import { CopilotChat, useComponent } from "@copilotkit/react-core/v2";
import {
  CategoryPieChart,
  CategoryPieChartProps,
} from "@/components/generative/CategoryPieChart";
import { BudgetCard, BudgetCardProps } from "@/components/generative/BudgetCard";

export default function ChatPage() {
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
      <div className="chat-window">
        <CopilotChat />
      </div>
    </main>
  );
}
