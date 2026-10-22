import { prisma } from "./prisma";
import { addMonths, monthRange } from "./dates";
import {
  average,
  budgetPercent,
  daysElapsedIn,
  daysInMonthOf,
  projectExpense,
  round2,
  toNumber,
} from "./calc";

interface Totals {
  income: number;
  expense: number;
}

/** Ingresos y gastos de un rango, sumados en la base de datos (SUM ... GROUP BY). */
async function totalsFor(userId: number, start: Date, end: Date): Promise<Totals> {
  const rows = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  const totals: Totals = { income: 0, expense: 0 };
  for (const row of rows) {
    const value = toNumber(row._sum.amount);
    if (row.type === "INCOME") totals.income += value;
    else totals.expense += value;
  }
  return totals;
}

export async function computeSummary(userId: number, month: string, now = new Date()) {
  const { start, end } = monthRange(month);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));

  const [series, spentRows, accountRows, accounts, categories, budgets] = await Promise.all([
    Promise.all(
      months.map((m) => {
        const r = monthRange(m);
        return totalsFor(userId, r.start, r.end);
      }),
    ),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["accountId", "type"],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.account.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.budget.findMany({ where: { userId, month: start } }),
  ]);

  const current = series[series.length - 1];
  const catById = new Map(categories.map((c) => [c.id, c] as const));
  const spentByCategory = new Map<number, number>(
    spentRows.map((r) => [r.categoryId, toNumber(r._sum.amount)] as const),
  );

  const byCategory = [...spentByCategory.entries()]
    .map(([categoryId, total]) => {
      const c = catById.get(categoryId);
      return { categoryId, name: c?.name ?? "—", color: c?.color ?? "#64748b", total: round2(total) };
    })
    .sort((a, b) => b.total - a.total);

  const budgetRows = budgets.map((b) => {
    const c = catById.get(b.categoryId);
    const limit = toNumber(b.limitAmount);
    const spent = spentByCategory.get(b.categoryId) ?? 0;
    return {
      id: b.id,
      categoryId: b.categoryId,
      name: c?.name ?? "—",
      color: c?.color ?? "#64748b",
      limit: round2(limit),
      spent: round2(spent),
      percent: budgetPercent(spent, limit),
    };
  });

  const movement = new Map<number, number>();
  for (const r of accountRows) {
    const value = toNumber(r._sum.amount);
    movement.set(r.accountId, (movement.get(r.accountId) ?? 0) + (r.type === "INCOME" ? value : -value));
  }
  const accountSummary = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: round2(toNumber(a.initialBalance) + (movement.get(a.id) ?? 0)),
  }));

  const daysInMonth = daysInMonthOf(month);
  const daysElapsed = daysElapsedIn(month, now.toISOString().slice(0, 7), now.getUTCDate());
  const avgPrev3 = average(series.slice(2, 5).map((s) => s.expense));

  return {
    month,
    income: round2(current.income),
    expense: round2(current.expense),
    balance: round2(current.income - current.expense),
    totalBalance: round2(accountSummary.reduce((sum, a) => sum + a.balance, 0)),
    accounts: accountSummary,
    byCategory,
    budgets: budgetRows,
    monthly: months.map((m, i) => ({
      month: m,
      income: round2(series[i].income),
      expense: round2(series[i].expense),
    })),
    projection: {
      daysElapsed,
      daysInMonth,
      spentSoFar: round2(current.expense),
      projectedExpense: round2(projectExpense(current.expense, daysElapsed, daysInMonth)),
      avgPrev3Months: round2(avgPrev3),
    },
  };
}