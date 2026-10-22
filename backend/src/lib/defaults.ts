import { prisma } from "./prisma";

const DEFAULT_CATEGORIES = [
  { name: "Nómina", type: "INCOME", color: "#22c55e" },
  { name: "Otros ingresos", type: "INCOME", color: "#14b8a6" },
  { name: "Comida", type: "EXPENSE", color: "#ef4444" },
  { name: "Transporte", type: "EXPENSE", color: "#f97316" },
  { name: "Vivienda", type: "EXPENSE", color: "#8b5cf6" },
  { name: "Ocio", type: "EXPENSE", color: "#ec4899" },
  { name: "Salud", type: "EXPENSE", color: "#06b6d4" },
  { name: "Compras", type: "EXPENSE", color: "#eab308" },
  { name: "Otros gastos", type: "EXPENSE", color: "#64748b" },
] as const;

/** Crea las categorías por defecto que aún no existan para el usuario. */
export async function createDefaultCategories(userId: number) {
  const existing = await prisma.category.findMany({
    where: { userId },
    select: { name: true, type: true },
  });
  const have = new Set(existing.map((c) => `${c.type}:${c.name}`));
  const missing = DEFAULT_CATEGORIES.filter((c) => !have.has(`${c.type}:${c.name}`));
  if (missing.length === 0) return 0;
  await prisma.category.createMany({
    data: missing.map((c) => ({ ...c, userId })),
  });
  return missing.length;
}

export async function createDefaultAccount(userId: number) {
  const count = await prisma.account.count({ where: { userId } });
  if (count === 0) {
    await prisma.account.create({
      data: { userId, name: "Cuenta principal", type: "BANK", initialBalance: 0 },
    });
  }
}