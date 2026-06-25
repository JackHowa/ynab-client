"use client";

import { useEffect, useState } from "react";

interface Account {
  id: string;
  name: string;
  balance: number;
}
interface Budget {
  id: string;
  name: string;
  currency: string;
  accounts: Account[];
}

type State =
  | { status: "loading" }
  | { status: "loggedOut" }
  | { status: "error"; message: string }
  | { status: "ready"; budgets: Budget[] };

export default function Home() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    async function loadBudgets() {
      const res = await fetch("/api/budgets");
      if (res.status === 401) return setState({ status: "loggedOut" });
      const body = await res.json();
      if (!res.ok) {
        return setState({ status: "error", message: body.error ?? "Request failed" });
      }
      setState({ status: "ready", budgets: body.budgets });
    }

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error");
      const code = params.get("code");
      const stateParam = params.get("state");

      // YNAB redirects back to "/" with ?code & ?state — finish the exchange.
      if (code && stateParam) {
        const res = await fetch("/api/auth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state: stateParam }),
        });
        window.history.replaceState({}, "", "/"); // strip code from the URL
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return setState({ status: "error", message: body.error ?? "Login failed" });
        }
      } else if (oauthError) {
        window.history.replaceState({}, "", "/");
        return setState({ status: "error", message: oauthError });
      }

      await loadBudgets();
    }

    run().catch((err) => setState({ status: "error", message: String(err) }));
  }, []);

  return (
    <main>
      <header>
        <h1>YNAB Budgets</h1>
        <nav style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <a className="button" href="/chat">
            AI Assistant
          </a>
          {state.status === "ready" && (
            <form method="POST" action="/api/auth/logout">
              <button type="submit" className="button">
                Log out
              </button>
            </form>
          )}
        </nav>
      </header>

      {state.status === "loading" && <p>Loading…</p>}

      {state.status === "loggedOut" && (
        <div className="connect">
          <p>Connect your YNAB account to view your budgets (read-only).</p>
          <a className="button" href="/api/auth/login">
            Connect to YNAB
          </a>
        </div>
      )}

      {state.status === "error" && <p className="error">{state.message}</p>}

      {state.status === "ready" && (
        <ul className="budgets">
          {state.budgets.map((budget) => (
            <li key={budget.id} className="budget">
              <h2>{budget.name}</h2>
              <ul>
                {budget.accounts.map((account) => (
                  <li key={account.id}>
                    <span>{account.name}</span>
                    <span>
                      {account.balance.toFixed(2)} {budget.currency}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
