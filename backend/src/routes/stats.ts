import { Router } from "express";
import { currentMonth, isMonth } from "../lib/dates";
import { computeSummary } from "../lib/stats";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// GET /api/stats/summary?month=2026-10
router.get("/summary", async (req: AuthRequest, res) => {
  const month = isMonth(req.query.month) ? req.query.month : currentMonth();
  res.json(await computeSummary(req.userId!, month));
});

export default router;