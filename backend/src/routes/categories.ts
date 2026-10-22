import { Router } from "express";
import { z } from "zod";
import { createDefaultCategories } from "../lib/defaults";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { parseId, parseWith } from "../lib/validate";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const categorySchema = z.object({
  name: z.string().trim().min(1, "el nombre es obligatorio").max(60),
  type: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "color no válido").default("#6366f1"),
  icon: z.string().max(50).optional(),
});

router.get("/", async (req: AuthRequest, res) => {
  const items = await prisma.category.findMany({
    where: { userId: req.userId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  res.json(items);
});

// Crea las categorías por defecto que falten
router.post("/defaults", async (req: AuthRequest, res) => {
  const created = await createDefaultCategories(req.userId!);
  res.status(201).json({ created });
});

router.post("/", async (req: AuthRequest, res) => {
  const data = parseWith(categorySchema, req.body);
  const item = await prisma.category.create({ data: { ...data, userId: req.userId! } });
  res.status(201).json(item);
});

router.put("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  const data = parseWith(categorySchema, req.body);

  const exists = await prisma.category.findFirst({ where: { id, userId: req.userId } });
  if (!exists) throw new HttpError(404, "Categoría no encontrada");

  const item = await prisma.category.update({ where: { id }, data });
  res.json(item);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  const used = await prisma.transaction.count({ where: { categoryId: id, userId: req.userId } });
  if (used > 0) throw new HttpError(409, "La categoría tiene movimientos asociados");

  const result = await prisma.category.deleteMany({ where: { id, userId: req.userId } });
  if (result.count === 0) throw new HttpError(404, "Categoría no encontrada");
  res.status(204).send();
});

export default router;