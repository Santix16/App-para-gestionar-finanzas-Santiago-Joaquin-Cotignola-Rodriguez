import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { moneyAmount, parseId, parseWith } from "../lib/validate";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const accountSchema = z.object({
  name: z.string().trim().min(1, "el nombre es obligatorio").max(100),
  type: z.enum(["BANK", "CASH", "SAVINGS"]),
  initialBalance: moneyAmount.default(0),
});

router.get("/", async (req: AuthRequest, res) => {
  const items = await prisma.account.findMany({
    where: { userId: req.userId },
    orderBy: { id: "asc" },
  });
  res.json(items);
});

router.post("/", async (req: AuthRequest, res) => {
  const data = parseWith(accountSchema, req.body);
  const item = await prisma.account.create({ data: { ...data, userId: req.userId! } });
  res.status(201).json(item);
});

router.put("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  const data = parseWith(accountSchema, req.body);

  const exists = await prisma.account.findFirst({ where: { id, userId: req.userId } });
  if (!exists) throw new HttpError(404, "Cuenta no encontrada");

  const item = await prisma.account.update({ where: { id }, data });
  res.json(item);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const id = parseId(req.params.id);
  const result = await prisma.account.deleteMany({ where: { id, userId: req.userId } });
  if (result.count === 0) throw new HttpError(404, "Cuenta no encontrada");
  res.status(204).send();
});

export default router;