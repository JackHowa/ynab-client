import { ynabFromEnv, fromMilliunits } from "@/lib/ynab";

// Server Component: fetches YNAB data on the server so the token never
// reaches the browser. Rendered fresh on each request.
export const dynamic = "force-dynamic";

export default async function Home() {
  let content;

  try {
    const ynab = ynabFromEnv();
    const budgets = await ynab.getBudgets();

    const withAccounts = await Promise.all(
      budgets.map(async (budget) => ({
        budget,
        accounts: (await ynab.getAccounts(budget.id)).filter((a) => !a.closed),
      })),
    );

    content = (
      <ul className="budgets">
        {withAccounts.map(({ budget, accounts }) => (
          <li key={budget.id} className="budget">
            <h2>{budget.name}</h2>
            <ul>
              {accounts.map((account) => {
                const code = budget.currency_format?.iso_code ?? "";
                return (
                  <li key={account.id}>
                    <span>{account.name}</span>
                    <span>
                      {fromMilliunits(account.balance).toFixed(2)} {code}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    );
  } catch (err) {
    content = (
      <p className="error">{err instanceof Error ? err.message : String(err)}</p>
    );
  }

  return (
    <main>
      <h1>YNAB Budgets</h1>
      {content}
    </main>
  );
}
