# Goals & Roadmap

**Vision:** Turn this YNAB OAuth app into a conversational budget dashboard —
a chat where a Claude-backed agent reads your YNAB data and answers with **rich,
interactive UI** (cards, charts, tables), not just text. Built on **CopilotKit
Controlled Generative UI**: we author React components and register them as
typed tools; the agent picks which to render and populates them with validated
data.

## Where we are (done)

- ✅ Next.js + React app, deployed-ready.
- ✅ YNAB **OAuth 2.0** (auth code + PKCE, `read-only` scope).
- ✅ Encrypted httpOnly session cookie; tokens stay server-side; auto-refresh.
- ✅ Baseline UI: lists budgets + open accounts with balances.

## Phase 1 — Data layer

Expand the typed YNAB client + API routes so the agent has something rich to
render. All read-only.

- [ ] `getCategories(budgetId)` — category groups, budgeted/activity/balance.
- [ ] `getTransactions(budgetId, sinceDate?)` — for trends and breakdowns.
- [ ] `getMonth(budgetId, month)` — month summary (to be budgeted, age of money).
- [ ] Server-side aggregation helpers: spending-by-category, spending-by-month.

## Phase 2 — CopilotKit integration

- [ ] Add `@copilotkit/react-core` (+ `/v2`) and a **CopilotKit runtime** as a
      Next.js API route (`/api/copilotkit`), backed by a **Claude** model
      (latest — e.g. Sonnet for cost/latency, Opus for harder reasoning).
- [ ] Give the agent **read-only YNAB tools** (backed by the session token) so
      it can fetch budgets/accounts/categories/transactions on demand.
- [ ] Drop `<CopilotChat />` into the app behind the existing OAuth gate.
- [ ] Expose current context to the agent (selected budget, date range) so it
      doesn't have to re-ask.

## Phase 3 — Controlled Generative UI components

Author each component once, define a **Zod props schema**, register with
`useComponent({ name, description, parameters, render })`. The agent calls them
as tools.

- [ ] `CategorySpendingPieChart` — spending distribution by category.
- [ ] `AccountBalanceCard` — single account: name, type, balance, on/off-budget.
- [ ] `SpendingTrendLineChart` — spending over time (by month).
- [ ] `BudgetSummaryCard` — to-be-budgeted, age of money, key totals.
- [ ] `TransactionTable` — filtered transactions (payee, category, amount, date).
- [ ] Shared formatting (milliunits → currency, ISO codes) reused across all.

Example targets:
- *"Show my spending by category last month as a pie chart"* → `CategorySpendingPieChart`
- *"How's my checking account?"* → `AccountBalanceCard`
- *"Am I trending up on dining?"* → `SpendingTrendLineChart`

## Phase 4 — Declarative Generative UI (stretch)

- [ ] Move from individually-registered components to a **catalog of building
      blocks** the agent composes into layouts (A2UI / declarative spectrum),
      for multi-widget dashboards in one response.

## Phase 5 — Polish & deploy

- [ ] Deploy to Vercel; register the prod redirect URI; set encrypted env vars.
- [ ] Loading/empty/error states for every generative component.
- [ ] Respect YNAB rate limits (200 req/hr/token) — cache aggregates per request.
- [ ] Optional: budget switcher, date-range picker, dark-mode polish.

## Guardrails / principles

- **Read-only** end to end — the OAuth scope can't modify a budget; keep it that
  way unless we deliberately add write features (which would need a new scope).
- **Tokens never reach the browser** — the agent calls YNAB server-side.
- **Controlled before open-ended** — favor registered, validated components for
  financial data; only loosen toward declarative UI once patterns stabilize.

## References

- CopilotKit Controlled Generative UI (`useComponent()` v2) — DeepLearning.AI,
  *Build Interactive Agents with Generative UI*, Lesson 3:
  <https://learn.deeplearning.ai/courses/build-interactive-agents-with-generative-ui/lesson/gy3o4e/lesson-3%3A-controlled-generative-ui>
- Lesson 4 (next): declarative generative UI via the A2UI spec.
- YNAB API: <https://api.ynab.com>
