# ynab-client

A **Next.js + React** conversational budget assistant for [YNAB](https://api.ynab.com).
Chat with your budget and get **generative UI** back — charts, cards, and tables —
powered by [CopilotKit](https://copilotkit.ai) and Claude.

Ask things like:

- "How much have I spent at Panda Express over time?" → spend-over-time chart
- "Show my spending by category" / "combine Dining + Coffee" → pie chart
- "List transactions over $100 last month" → filtered transactions
- "How's this month looking?" → income / budgeted / to-be-budgeted summary
- "Am I over on Dining?" → budget-vs-actual per category
- "Show my account balances" → budget card
- "Plan a budget for a trip to Norway" → editable plan card

## How it works

- **OAuth 2.0** (auth code + PKCE, `read-only`) connects YNAB; tokens live in an
  encrypted httpOnly cookie and only ever touch the server.
- A **CopilotKit** runtime (`/api/copilotkit`) runs a Claude agent with
  server-side tools that read your budget. Tools get the YNAB token per-request
  via `AsyncLocalStorage`.
- The agent renders **registered generative-UI components** (`useComponent`) and
  can compose **open-ended declarative UI** via A2UI.
- **Multi-budget**: defaults to your most-recently-modified budget; name one to
  target it ("…in Jack's budget"); `listBudgets` to browse.
- **Demo mode** (`DEMO_MODE=1`) serves fabricated data so you can demo without
  real balances.

## Setup

1. `npm install`
2. Create a YNAB **OAuth app** at <https://app.ynab.com/settings/developer>;
   register a redirect URI equal to your origin (`http://localhost:3000` for dev,
   `https://<project>.vercel.app` in prod).
3. Create `.env.local` (gitignored):

   ```bash
   YNAB_CLIENT_ID=...
   YNAB_CLIENT_SECRET=...
   SESSION_SECRET=...            # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ANTHROPIC_API_KEY=sk-ant-...  # the chat model
   # Optional:
   # COPILOTKIT_MODEL=anthropic/claude-sonnet-4-6   # default: anthropic/claude-haiku-4-5
   # COPILOT_KIT_SECRET=...                          # CopilotKit Intelligence (durable threads)
   # DEMO_MODE=1                                      # serve fabricated data
   ```

4. `npm run dev` → <http://localhost:3000>. Connect YNAB, then chat.

## Project map

| Path                              | Purpose                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `app/page.tsx`                    | Main screen: the assistant chat + budget names + auth.        |
| `components/AssistantChat.tsx`    | Registers gen-UI components + starter prompts; mounts chat.   |
| `components/generative/*`         | Chart/card components (Zod props) the agent renders.          |
| `app/api/copilotkit/[[...slug]]/` | CopilotKit runtime: Claude agent + YNAB server-side tools.    |
| `lib/ynab.ts`                     | Typed YNAB client (budgets, accounts, transactions, …).       |
| `lib/server-ynab.ts`              | Session access token (auto-refresh).                          |
| `lib/demo-data.ts`                | Fabricated data for `DEMO_MODE`.                              |
| `lib/oauth.ts` / `lib/session.ts` | OAuth flow + encrypted session cookie.                        |

## Deploying to Vercel

Add the redirect URI for the prod origin on the YNAB app, and set the env vars
above (including `ANTHROPIC_API_KEY`) as encrypted Vercel env vars, then deploy.

## Notes

- Dev uses **Turbopack** (`next dev --turbopack`) for reliable HMR.
- See `GOALS.md` for the roadmap (saved dashboards, chat history, more
  open/declarative UI).
- API base: `https://api.ynab.com/v1` · auth via `Authorization: Bearer <token>`.
