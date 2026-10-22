import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { computeSummary } from "../lib/stats";
import { currentMonth, isMonth, monthRange } from "../lib/dates";

const router = Router();
router.use(requireAuth);

async function loadData(userId: number, monthQuery: unknown) {
  const month = isMonth(monthQuery) ? monthQuery : currentMonth();
  const { start, end } = monthRange(month);
  const [summary, txs, user] = await Promise.all([
    computeSummary(userId, month),
    prisma.transaction.findMany({
      where: { userId, date: { gte: start, lt: end } },
      include: { category: true, account: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  return { month, summary, txs, currency: user?.currency ?? "EUR", name: user?.name ?? "" };
}

const day = (d: Date) => d.toISOString().slice(0, 10);

// GET /api/reports/excel?month=2026-10
router.get("/excel", async (req: AuthRequest, res) => {
  const { month, summary, txs, currency } = await loadData(req.userId!, req.query.month);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Finanzas personales";

  const resumen = wb.addWorksheet("Resumen");
  resumen.columns = [
    { header: "Concepto", key: "k", width: 32 },
    { header: `Importe (${currency})`, key: "v", width: 20 },
  ];
  resumen.addRows([
    { k: "Mes", v: month },
    { k: "Ingresos", v: summary.income },
    { k: "Gastos", v: summary.expense },
    { k: "Balance del mes", v: summary.balance },
    { k: "Proyección de gasto del mes", v: summary.projection.projectedExpense },
    { k: "Media de gasto (3 meses previos)", v: summary.projection.avgPrev3Months },
    { k: "Saldo total de cuentas", v: summary.totalBalance },
  ]);
  resumen.addRow({});
  resumen.addRow({ k: "Gasto por categoría" }).font = { bold: true };
  for (const c of summary.byCategory) resumen.addRow({ k: c.name, v: c.total });
  resumen.addRow({});
  resumen.addRow({ k: "Presupuestos (gastado / límite)" }).font = { bold: true };
  for (const b of summary.budgets)
    resumen.addRow({ k: `${b.name} (${b.percent} %)`, v: `${b.spent} / ${b.limit}` });
  resumen.getRow(1).font = { bold: true };
  resumen.getColumn("v").numFmt = "#,##0.00";

  const sheet = wb.addWorksheet("Movimientos");
  sheet.columns = [
    { header: "Fecha", key: "date", width: 12 },
    { header: "Tipo", key: "type", width: 12 },
    { header: "Categoría", key: "category", width: 20 },
    { header: "Cuenta", key: "account", width: 20 },
    { header: "Nota", key: "note", width: 36 },
    { header: `Importe (${currency})`, key: "amount", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const t of txs) {
    sheet.addRow({
      date: day(t.date),
      type: t.type === "INCOME" ? "Ingreso" : "Gasto",
      category: t.category.name,
      account: t.account.name,
      note: t.note ?? "",
      amount: t.type === "INCOME" ? Number(t.amount) : -Number(t.amount),
    });
  }
  sheet.getColumn("amount").numFmt = "#,##0.00";

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="finanzas-${month}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// GET /api/reports/pdf?month=2026-10
router.get("/pdf", async (req: AuthRequest, res) => {
  const { month, summary, txs, currency, name } = await loadData(req.userId!, req.query.month);
  const money = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="finanzas-${month}.pdf"`);

  const doc = new PDFDocument({ margin: 48, size: "A4" });
  doc.pipe(res);

  doc.fontSize(20).text("Informe de finanzas personales");
  doc.fontSize(11).fillColor("#555").text(`${name ? name + " · " : ""}Mes: ${month}`);
  doc.moveDown();

  doc.fillColor("#000").fontSize(13).text("Resumen");
  doc.fontSize(11);
  const lines: [string, string][] = [
    ["Ingresos", money(summary.income)],
    ["Gastos", money(summary.expense)],
    ["Balance del mes", money(summary.balance)],
    ["Proyección de gasto del mes", money(summary.projection.projectedExpense)],
    ["Media de gasto (3 meses previos)", money(summary.projection.avgPrev3Months)],
    ["Saldo total de cuentas", money(summary.totalBalance)],
  ];
  for (const [k, v] of lines) {
    const y = doc.y;
    doc.text(k, 48, y, { width: 300 });
    doc.text(v, 350, y, { width: 197, align: "right" });
  }
  doc.moveDown();

  if (summary.byCategory.length) {
    doc.fontSize(13).text("Gasto por categoría", 48);
    doc.fontSize(11);
    for (const c of summary.byCategory) {
      const y = doc.y;
      doc.text(c.name, 48, y, { width: 300 });
      doc.text(money(c.total), 350, y, { width: 197, align: "right" });
    }
    doc.moveDown();
  }

  if (summary.budgets.length) {
    doc.fontSize(13).text("Presupuestos", 48);
    doc.fontSize(11);
    for (const b of summary.budgets) {
      const y = doc.y;
      doc.text(`${b.name} (${b.percent} %)`, 48, y, { width: 300 });
      doc.text(`${money(b.spent)} / ${money(b.limit)}`, 300, y, { width: 247, align: "right" });
    }
    doc.moveDown();
  }

  doc.fontSize(13).text("Movimientos", 48);
  doc.fontSize(10);
  if (txs.length === 0) doc.text("Sin movimientos en este mes.");
  for (const t of txs) {
    if (doc.y > 760) doc.addPage();
    const y = doc.y;
    const signed = t.type === "INCOME" ? Number(t.amount) : -Number(t.amount);
    doc.text(day(t.date), 48, y, { width: 62 });
    doc.text(t.category.name, 112, y, { width: 110 });
    doc.text(t.note ?? "", 226, y, { width: 190, height: 12, ellipsis: true });
    doc.text(money(signed), 420, y, { width: 127, align: "right" });
  }

  doc.end();
});

export default router;