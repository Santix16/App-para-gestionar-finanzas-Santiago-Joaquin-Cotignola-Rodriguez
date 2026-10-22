import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    transaction: { groupBy: vi.fn() },
    account: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    budget: { findMany: vi.fn() },
  },
}));
vi.mock("./prisma", () => ({ prisma: prismaMock }));

import { computeSummary } from "./stats";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.transaction.groupBy.mockImplementation(async (args: { by: string[] }) => {
    if (args.by.includes("categoryId"))
      return [
        { categoryId: 1, _sum: { amount: "120.50" } },
        { categoryId: 2, _sum: { amount: "30" } },
      ];
    if (args.by.includes("accountId"))
      return [
        { accountId: 1, type: "INCOME", _sum: { amount: "1000" } },
        { accountId: 1, type: "EXPENSE", _sum: { amount: "150.5" } },
      ];
    return [
      { type: "INCOME", _sum: { amount: "2000" } },
      { type: "EXPENSE", _sum: { amount: "150.5" } },
    ];
  });
  prismaMock.account.findMany.mockResolvedValue([
    { id: 1, name: "Banco", type: "BANK", initialBalance: "500" },
  ]);
  prismaMock.category.findMany.mockResolvedValue([
    { id: 1, name: "Comida", color: "#ef4444" },
    { id: 2, name: "Ocio", color: "#ec4899" },
  ]);
  prismaMock.budget.findMany.mockResolvedValue([{ id: 9, categoryId: 1, limitAmount: "100" }]);
});

describe("computeSummary (agregado en BD)", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  it("calcula totales, balance y saldo de cuentas", async () => {
    const s = await computeSummary(1, "2026-09", now);
    expect(s.income).toBe(2000);
    expect(s.expense).toBe(150.5);
    expect(s.balance).toBe(1849.5);
    expect(s.accounts).toEqual([{ id: 1, name: "Banco", type: "BANK", balance: 1349.5 }]);
    expect(s.totalBalance).toBe(1349.5);
  });

  it("ordena el gasto por categoría y calcula presupuestos", async () => {
    const s = await computeSummary(1, "2026-09", now);
    expect(s.byCategory.map((c) => c.name)).toEqual(["Comida", "Ocio"]);
    expect(s.byCategory[0].total).toBe(120.5);
    expect(s.budgets[0]).toMatchObject({ name: "Comida", limit: 100, spent: 120.5, percent: 121 });
  });

  it("devuelve la evolución de 6 meses terminando en el mes pedido", async () => {
    const s = await computeSummary(1, "2026-09", now);
    expect(s.monthly).toHaveLength(6);
    expect(s.monthly[0].month).toBe("2026-04");
    expect(s.monthly[5].month).toBe("2026-09");
  });

  it("mes pasado: la proyección es el gasto real", async () => {
    const s = await computeSummary(1, "2026-09", now);
    expect(s.projection.daysElapsed).toBe(30);
    expect(s.projection.projectedExpense).toBe(150.5);
    expect(s.projection.avgPrev3Months).toBe(150.5);
  });

  it("mes en curso: proyecta según los días transcurridos", async () => {
    const s = await computeSummary(1, "2026-10", now);
    expect(s.projection.daysElapsed).toBe(15);
    expect(s.projection.daysInMonth).toBe(31);
    expect(s.projection.projectedExpense).toBe(311.03); // 150.5 / 15 * 31
  });

  it("hace las sumas con groupBy en la base de datos (sin leer todos los movimientos)", async () => {
    await computeSummary(1, "2026-09", now);
    // 6 meses + gasto por categoría + saldos por cuenta
    expect(prismaMock.transaction.groupBy).toHaveBeenCalledTimes(8);
  });
});