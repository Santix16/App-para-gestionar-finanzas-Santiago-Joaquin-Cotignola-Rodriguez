import { Router } from "express";
import { z } from "zod";
import { MONTH_REGEX, isMonth } from "../lib/dates";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { moneyAmount, parseId, parseWith } from "../lib/validate";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const budgetSchema = z.object({
  categoryId: z.number().int().positive(),
  month: z.string().regex(MONTH_REGEX, "mes no válido (usa AAAA-MM)"),
  limitAmount: moneyAmount.refine((v) => v > 0, "el límite debe ser mayor que 0"),
});

router.get("/", async (req: AuthRequest, res) => {
  const { month } = req.query;
  const where: { userId: number; month?: Date } = { userId: req.userId! };
  if (isMonth(month)) where.month = new Date(`${month}-01T00:00:00Z`);

  const items = await prisma.budget.findMany({ where, include: { category: true } });
  res.json(items);
});

router.put("/", async (req: AuthRequest, res) => {
  const { categoryId, month, limitAmount } = parseWith(budgetSchema, req.body);

  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId: req.userId, type: "EXPENSE" },
  });
  if (!category) throw new HttpError(400, "Categoría de gasto no válida");

  const monthDate = new Date(`${month}-01T00:00:00Z`);
  const item = await prisma.budget.upsert({
    where: { userId_categoryId_month: { userId: req.userId!, categoryId, month: monthDate } },
    update: { limitAmount },
    create: { userId: req.userId!, categoryId, month: monthDate, limitAmount },
  });
  res.json(item);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  const result = await prisma.budget.deleteMany({ where: { id, userId: req.userId } });
  if (result.count === 0) throw new HttpError(404, "Presupuesto no encontrado");
  res.status(204).send();
});

export default router;