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

## Target use cases (what the assistant should nail)

1. **Spend-by-payee over time** — "graph what I spent at Panda Express over the
   last 6 months." Needs transaction-level data + payee filtering + a time-series
   (line/bar) chart component.
2. **Combine categories on the fly** — let the user merge/group categories
   ("treat Dining + Coffee + Takeout as one") for analysis, without changing
   their actual YNAB setup. Aggregation happens in our layer.
3. **Generate a plan / category set** — "set up categories for a trip to Norway"
   → the agent proposes a structured budget (categories + suggested amounts) and
   renders it as an editable plan card.
   - Read-only today: present it as a **suggestion** in the UI. Actually writing
     categories back to YNAB would require a write OAuth scope — a deliberate,
     later opt-in (see guardrails).

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

## Phase 4 — Declarative Generative UI (OpenGenerativeUI / A2UI) — PRIORITY

Move to CopilotKit's **declarative generative UI** so the agent emits pretty,
composed surfaces (cards + charts) rather than us pre-registering each one.

- [ ] Enable A2UI: `CopilotRuntime({ a2ui: {} })` + `<CopilotKit a2ui={{ theme }}>`
      (renderer auto-mounts via `/info`; `createA2UIMessageRenderer` from
      `@copilotkit/react-core/v2`, primitives from `@copilotkit/a2ui-renderer`).
- [ ] Build a **catalog** of polished building blocks: stat cards, a category
      **pie/bar chart**, and a **transaction-grouping** chart (group by payee or
      merged categories) — the headline asks.
- [ ] Make them visually strong (theme, spacing, color) — "make it pretty."

References (example sources to mirror):
- CopilotKit declarative gen UI examples: <https://github.com/CopilotKit/generative-ui>
- OpenGenerativeUI: <https://github.com/CopilotKit/OpenGenerativeUI>
- `a2ui-renderer` skill (installed locally) + DeepLearning.AI Lesson 4.

## Phase 5 — Polish & deploy

- [ ] Deploy to Vercel; register the prod redirect URI; set encrypted env vars.
- [ ] Loading/empty/error states for every generative component.
- [ ] Respect YNAB rate limits (200 req/hr/token) — cache aggregates per request.
- [ ] Optional: budget switcher, date-range picker, dark-mode polish.

## Phase 6 — Demo / fake-data mode (do last)

So the app can be demoed **without exposing real personal YNAB data**.

- [ ] A `DEMO_MODE` (env flag) or `/demo` route that serves a realistic but
      **fabricated** budget: a couple of budgets, plausible accounts/balances,
      category spending, and a few months of transactions.
- [ ] Wire it behind the same data layer (`lib/server-ynab` / API routes) so the
      generative-UI components and the agent render identically to real data —
      just sourced from a fixture instead of the YNAB API.
- [ ] Make it the default for screenshots/recordings; never ship real balances.

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
