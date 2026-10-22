const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-10" -> [2026-10-01, 2026-11-01) en UTC */
export function monthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

/** Suma n meses (puede ser negativo) a "YYYY-MM" */
export function addMonths(month: string, n: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

export const MONTH_REGEX = MONTH_RE;