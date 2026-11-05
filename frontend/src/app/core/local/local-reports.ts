import type { ReportData } from './local-repo';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const day = (iso: string) => iso.slice(0, 10);

export interface ReportFile {
  filename: string;
  blob: Blob;
}

/** Informe en Excel (misma estructura que el de la API: hoja Resumen y hoja Movimientos). */
export async function buildExcel(d: ReportData): Promise<ReportFile> {
  // Se carga bajo demanda: la librería es grande y solo hace falta al exportar
  const mod = (await import('exceljs')) as unknown as { default?: typeof import('exceljs') };
  const ExcelJS = (mod.default ?? mod) as typeof import('exceljs');
  const { summary, txs, currency, month } = d;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Finanzas personales';

  const resumen = wb.addWorksheet('Resumen');
  resumen.columns = [
    { header: 'Concepto', key: 'k', width: 32 },
    { header: `Importe (${currency})`, key: 'v', width: 20 },
  ];
  resumen.addRows([
    { k: 'Mes', v: month },
    { k: 'Ingresos', v: summary.income },
    { k: 'Gastos', v: summary.expense },
    { k: 'Balance del mes', v: summary.balance },
    { k: 'Proyección de gasto del mes', v: summary.projection.projectedExpense },
    { k: 'Media de gasto (3 meses previos)', v: summary.projection.avgPrev3Months },
    { k: 'Saldo total de cuentas', v: summary.totalBalance },
  ]);
  resumen.addRow({});
  resumen.addRow({ k: 'Gasto por categoría' }).font = { bold: true };
  for (const c of summary.byCategory) resumen.addRow({ k: c.name, v: c.total });
  resumen.addRow({});
  resumen.addRow({ k: 'Presupuestos (gastado / límite)' }).font = { bold: true };
  for (const b of summary.budgets) {
    resumen.addRow({ k: `${b.name} (${b.percent} %)`, v: `${b.spent} / ${b.limit}` });
  }
  resumen.getRow(1).font = { bold: true };
  resumen.getColumn('v').numFmt = '#,##0.00';

  const sheet = wb.addWorksheet('Movimientos');
  sheet.columns = [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Categoría', key: 'category', width: 20 },
    { header: 'Cuenta', key: 'account', width: 20 },
    { header: 'Nota', key: 'note', width: 36 },
    { header: `Importe (${currency})`, key: 'amount', width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const t of txs) {
    sheet.addRow({
      date: day(t.date),
      type: t.type === 'INCOME' ? 'Ingreso' : 'Gasto',
      category: t.category.name,
      account: t.account.name,
      note: t.note ?? '',
      amount: t.type === 'INCOME' ? t.amount : -t.amount,
    });
  }
  sheet.getColumn('amount').numFmt = '#,##0.00';

  const buffer = await wb.xlsx.writeBuffer();
  return {
    filename: `finanzas-${month}.xlsx`,
    blob: new Blob([buffer as ArrayBuffer], { type: XLSX_MIME }),
  };
}

/** Informe en PDF: resumen, gasto por categoría, presupuestos y movimientos. */
export async function buildPdf(d: ReportData): Promise<ReportFile> {
  const { jsPDF } = await import('jspdf');
  const autoTableMod = await import('jspdf-autotable');
  const autoTable = autoTableMod.default ?? autoTableMod.autoTable;

  const { summary, txs, currency, month } = d;
  const money = (n: number) =>
    `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = margin;

  doc.setFontSize(20);
  doc.setTextColor(0);
  doc.text('Informe de finanzas personales', margin, y + 14);
  doc.setFontSize(11);
  doc.setTextColor(85);
  doc.text(`Mes: ${month}`, margin, y + 34);
  y += 52;

  const endY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  const section = (title: string, head: string[], body: string[][], rightCols: number[]) => {
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.text(title, margin, y + 12);
    autoTable(doc, {
      startY: y + 20,
      margin: { left: margin, right: margin },
      head: [head],
      body,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: Object.fromEntries(rightCols.map((i) => [i, { halign: 'right' }])),
    });
    y = endY() + 24;
  };

  section(
    'Resumen',
    ['Concepto', 'Importe'],
    [
      ['Ingresos', money(summary.income)],
      ['Gastos', money(summary.expense)],
      ['Balance del mes', money(summary.balance)],
      ['Proyección de gasto del mes', money(summary.projection.projectedExpense)],
      ['Media de gasto (3 meses previos)', money(summary.projection.avgPrev3Months)],
      ['Saldo total de cuentas', money(summary.totalBalance)],
    ],
    [1],
  );

  if (summary.byCategory.length) {
    section(
      'Gasto por categoría',
      ['Categoría', 'Total'],
      summary.byCategory.map((c) => [c.name, money(c.total)]),
      [1],
    );
  }

  if (summary.budgets.length) {
    section(
      'Presupuestos',
      ['Categoría', 'Uso', 'Gastado / límite'],
      summary.budgets.map((b) => [b.name, `${b.percent} %`, `${money(b.spent)} / ${money(b.limit)}`]),
      [1, 2],
    );
  }

  section(
    'Movimientos',
    ['Fecha', 'Categoría', 'Cuenta', 'Nota', 'Importe'],
    txs.length
      ? txs.map((t) => [
          day(t.date),
          t.category.name,
          t.account.name,
          t.note ?? '',
          money(t.type === 'INCOME' ? t.amount : -t.amount),
        ])
      : [['Sin movimientos en este mes.', '', '', '', '']],
    [4],
  );

  return { filename: `finanzas-${month}.pdf`, blob: doc.output('blob') };
}
