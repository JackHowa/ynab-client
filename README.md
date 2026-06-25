# ynab-client

A small **Next.js + React** app for accessing the [YNAB API](https://api.ynab.com).

It lists your budgets and the open accounts (with balances) in each. All YNAB
requests run **server-side**, so your access token never reaches the browser.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a YNAB **Personal Access Token** at
   <https://app.ynab.com/settings/developer>.

3. Copy the env template and add your token:

   ```bash
   cp .env.example .env.local
   # then edit .env.local and set YNAB_TOKEN=...
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

## What's inside

| Path                     | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `lib/ynab.ts`            | Typed YNAB API client (`getBudgets`, `getAccounts`) + helpers. |
| `app/page.tsx`           | Server Component that renders budgets and account balances.    |
| `app/api/budgets/route.ts` | JSON endpoint: `GET /api/budgets`.                           |

## Notes

- Balances come from the API in **milliunits** (1000 = 1 unit of currency);
  `fromMilliunits()` converts them.
- The token is read from `YNAB_TOKEN` and is only ever used on the server.

## API reference

- Base URL: `https://api.ynab.com/v1`
- Auth: `Authorization: Bearer <token>`
- Docs: <https://api.ynab.com>
