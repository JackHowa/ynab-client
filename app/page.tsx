"use client";

import { useEffect, useState } from "react";
import { AssistantChat } from "@/components/AssistantChat";

type Auth =
  | { status: "loading" }
  | { status: "loggedOut" }
  | { status: "ready"; budgets: string[] }
  | { status: "error"; message: string };

export default function Home() {
  const [auth, setAuth] = useState<Auth>({ status: "loading" });

  useEffect(() => {
    async function loadBudgets() {
      const res = await fetch("/api/budgets");
      if (res.status === 401) return setAuth({ status: "loggedOut" });
      const body = await res.json();
      if (!res.ok)
        return setAuth({ status: "error", message: body.error ?? "Request failed" });
      setAuth({
        status: "ready",
        budgets: (body.budgets ?? []).map((b: { name: string }) => b.name),
      });
    }

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const stateParam = params.get("state");
      const oauthError = params.get("error");

      // YNAB redirects back to "/" with ?code & ?state — finish the exchange.
      if (code && stateParam) {
        const res = await fetch("/api/auth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state: stateParam }),
        });
        window.history.replaceState({}, "", "/");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return setAuth({ status: "error", message: body.error ?? "Login failed" });
        }
      } else if (oauthError) {
        window.history.replaceState({}, "", "/");
        return setAuth({ status: "error", message: oauthError });
      }
      await loadBudgets();
    }

    run().catch((err) => setAuth({ status: "error", message: String(err) }));
  }, []);

  return (
    <main className="chat-page">
      <header>
        <h1>YNAB Assistant</h1>
        <nav style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {auth.status === "ready" ? (
            <form method="POST" action="/api/auth/logout">
              <button type="submit" className="button">
                Log out
              </button>
            </form>
          ) : auth.status === "loggedOut" ? (
            <a className="button" href="/api/auth/login">
              Connect to YNAB
            </a>
          ) : null}
        </nav>
      </header>

      {auth.status === "ready" && auth.budgets.length > 0 && (
        <p className="chat-hint">Budgets: {auth.budgets.join(" · ")}</p>
      )}
      {auth.status === "loggedOut" && (
        <p className="chat-hint">
          Connect your YNAB account to query real data — or just ask (demo data).
        </p>
      )}
      {auth.status === "error" && <p className="error">{auth.message}</p>}

      <AssistantChat />
    </main>
  );
}
