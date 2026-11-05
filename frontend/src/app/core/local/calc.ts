/** Funciones puras de cálculo, equivalentes a las del backend (sin base de datos). */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_RE.test(value);
}

/** "2026-10-21" (o ISO completo) -> "2026-10-21"; null si no es una fecha válida. */
export function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const day = value.slice(0, 10);
  if (!DATE_RE.test(day)) return null;
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day ? null : day;
}

/** Suma n meses (puede ser negativo) a "YYYY-MM". */
export function addMonths(month: string, n: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/** Nº de días del mes "YYYY-MM". */
export function daysInMonthOf(month: string): number {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** Días transcurridos del mes respecto a "hoy" (mes pasado = todos, futuro = 0). */
export function daysElapsedIn(month: string, nowMonth: string, nowDay: number): number {
  if (month < nowMonth) return daysInMonthOf(month);
  if (month === nowMonth) return nowDay;
  return 0;
}

/** Proyección lineal del gasto a fin de mes. */
export function projectExpense(spent: number, daysElapsed: number, daysInMonth: number): number {
  if (daysElapsed <= 0) return 0;
  if (daysElapsed >= daysInMonth) return spent;
  return (spent / daysElapsed) * daysInMonth;
}

export function budgetPercent(spent: number, limit: number): number {
  return limit > 0 ? Math.round((spent / limit) * 100) : 0;
}

/** Mes ("YYYY-MM") y día de "hoy" según la hora local del móvil. */
export function localToday(now: Date): { month: string; day: number } {
  return {
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    day: now.getDate(),
  };
}
