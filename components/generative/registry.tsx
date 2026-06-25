"use client";

import type { ComponentType } from "react";
import { CategoryPieChart } from "./CategoryPieChart";
import { BudgetCard } from "./BudgetCard";
import { SpendOverTimeChart } from "./SpendOverTimeChart";
import { PlanCard } from "./PlanCard";

// Maps a generative component's tool name -> its React component, so saved
// charts (just { name, args }) can be re-rendered on the dashboard.
export const GENERATIVE_COMPONENTS: Record<
  string,
  ComponentType<Record<string, unknown>>
> = {
  spendOverTimeChart: SpendOverTimeChart as ComponentType<Record<string, unknown>>,
  categoryPieChart: CategoryPieChart as ComponentType<Record<string, unknown>>,
  budgetCard: BudgetCard as ComponentType<Record<string, unknown>>,
  planCard: PlanCard as ComponentType<Record<string, unknown>>,
};

export function renderGenerative(name: string, args: Record<string, unknown>) {
  const Component = GENERATIVE_COMPONENTS[name];
  if (!Component) return null;
  return <Component {...args} />;
}
