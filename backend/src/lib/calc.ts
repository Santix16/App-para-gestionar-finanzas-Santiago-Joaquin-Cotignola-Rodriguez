/** Funciones puras de cálculo (sin base de datos), fáciles de probar. */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Convierte un Decimal de Prisma (o string/number/null) en número. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
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

export type BudgetLevel = "ok" | "near" | "over";

export function budgetLevel(percent: number): BudgetLevel {
  if (percent >= 100) return "over";
  if (percent >= 80) return "near";
  return "ok";
}