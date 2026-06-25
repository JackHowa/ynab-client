# ynab-client

A small **Next.js + React** app for accessing the [YNAB API](https://api.ynab.com)
via **OAuth 2.0**. It lists your budgets and the open accounts (with balances)
in each.

Auth uses the **Authorization Code grant with PKCE** and requests the
**`read-only`** scope, so the app can never modify a connected budget. Tokens
live in an **encrypted, httpOnly session cookie** and are only ever used
server-side — they never reach the browser.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create an **OAuth application** at <https://app.ynab.com/settings/developer>.
   Note its **Client ID** and **Client Secret**, and register a **Redirect URI**
   equal to your app's origin (YNAB matches it exactly):

   - Local: `http://localhost:3000`
   - Production: `https://<your-project>.vercel.app`

   > YNAB redirects the auth code back to the registered origin (`/`); the home
   > page completes the token exchange. The redirect URI is derived from the
   > request origin, so it always matches the registered value.

3. Create `.env.local` (gitignored) with:

   ```bash
   YNAB_CLIENT_ID=your-client-id
   YNAB_CLIENT_SECRET=your-client-secret
   # 32+ random bytes; generate with:
   #   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   SESSION_SECRET=your-session-secret
   ```

4. Run the dev server and open <http://localhost:3000>:

   ```bash
   npm run dev
   ```

   Click **Connect to YNAB**, approve, and your budgets load.

## What's inside

| Path                         | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `lib/ynab.ts`                | Typed YNAB API client (`getBudgets`, `getAccounts`) + helpers.     |
| `lib/oauth.ts`               | OAuth helpers: authorize URL, code exchange, refresh (PKCE).       |
| `lib/session.ts`             | AES-256-GCM encrypted httpOnly session cookie.                     |
| `app/page.tsx`               | Client UI: Connect button, budget list, logout; finishes login.   |
| `app/api/auth/login`         | Starts the flow (state + PKCE), redirects to YNAB.                 |
| `app/api/auth/exchange`      | Exchanges the returned code for tokens, sets the session.          |
| `app/api/auth/logout`        | Clears the session.                                                |
| `app/api/budgets`            | Returns budgets + accounts; refreshes the access token if expired. |

## Deploying to Vercel

1. Deploy the app (it'll show the logged-out state until OAuth is configured).
2. Add your Vercel production URL as a Redirect URI on the YNAB OAuth app.
3. Set `YNAB_CLIENT_ID`, `YNAB_CLIENT_SECRET`, and a **fresh** `SESSION_SECRET`
   as encrypted environment variables in Vercel, then redeploy.

## Notes

- Access tokens expire after 2 hours; the app refreshes them automatically using
  the stored refresh token.
- Balances come from the API in **milliunits** (1000 = 1 unit of currency);
  `fromMilliunits()` converts them.
- API base URL: `https://api.ynab.com/v1` — auth via `Authorization: Bearer <token>`.
