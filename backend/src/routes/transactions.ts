import { Router } from "express";
import { z } from "zod";
import { MONTH_REGEX, monthRange } from "../lib/dates";
import { toNumber, round2 } from "../lib/calc";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { moneyAmount, parseId, parseWith } from "../lib/validate";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const txSchema = z.object({
  accountId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  amount: moneyAmount.refine((v) => v > 0, "el importe debe ser mayor que 0"),
  type: z.enum(["INCOME", "EXPENSE"]),
  date: z.coerce.date("fecha no válida"),
  note: z.string().trim().max(500).optional(),
});

const listQuerySchema = z.object({
  month: z.string().regex(MONTH_REGEX, "mes no válido (usa AAAA-MM)").optional(),
  accountId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

async function validateOwnership(userId: number, data: z.infer<typeof txSchema>) {
  const [account, category] = await Promise.all([
    prisma.account.findFirst({ where: { id: data.accountId, userId } }),
    prisma.category.findFirst({ where: { id: data.categoryId, userId } }),
  ]);
  if (!account) throw new HttpError(400, "Cuenta no válida");
  if (!category) throw new HttpError(400, "Categoría no válida");
  if (category.type !== data.type) throw new HttpError(400, "El tipo no coincide con la categoría");
}

// GET /api/transactions?month=2026-10&accountId=1&categoryId=3&page=1&pageSize=20
router.get("/", async (req: AuthRequest, res) => {
  const q = parseWith(listQuerySchema, req.query);

  const where = {
    userId: req.userId!,
    ...(q.month ? { date: { gte: monthRange(q.month).start, lt: monthRange(q.month).end } } : {}),
    ...(q.accountId ? { accountId: q.accountId } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
  };

  const [items, total, sums] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, account: true },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.transaction.count({ where }),
    // Totales de TODO el filtro (no solo de la página), calculados en la base de datos
    prisma.transaction.groupBy({ by: ["type"], where, _sum: { amount: true } }),
  ]);

  const totals = { income: 0, expense: 0 };
  for (const s of sums) {
    const v = toNumber(s._sum.amount);
    if (s.type === "INCOME") totals.income += v;
    else totals.expense += v;
  }

  res.json({
    items,
    total,
    page: q.page,
    pageSize: q.pageSize,
    totals: { income: round2(totals.income), expense: round2(totals.expense) },
  });
});

router.post("/", async (req: AuthRequest, res) => {
  const data = parseWith(txSchema, req.body);
  await validateOwnership(req.userId!, data);

  const item = await prisma.transaction.create({ data: { ...data, userId: req.userId! } });
  res.status(201).json(item);
});

router.put("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  const data = parseWith(txSchema, req.body);

  const exists = await prisma.transaction.findFirst({ where: { id, userId: req.userId } });
  if (!exists) throw new HttpError(404, "Movimiento no encontrado");
  await validateOwnership(req.userId!, data);

  const item = await prisma.transaction.update({ where: { id }, data });
  res.json(item);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  const result = await prisma.transaction.deleteMany({ where: { id, userId: req.userId } });
  if (result.count === 0) throw new HttpError(404, "Movimiento no encontrado");
  res.status(204).send();
});

export default router;