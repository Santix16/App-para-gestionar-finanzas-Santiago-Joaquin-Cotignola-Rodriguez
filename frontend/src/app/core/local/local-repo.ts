import {
  Account,
  AccountType,
  Category,
  Page,
  Summary,
  Transaction,
  TransactionInput,
  TxType,
} from '../models';
import {
  addMonths,
  average,
  budgetPercent,
  daysElapsedIn,
  daysInMonthOf,
  isMonth,
  localToday,
  normalizeDate,
  projectExpense,
  round2,
} from './calc';

/**
 * Repositorio de datos local (modo APK). Replica las reglas y las respuestas de la API:
 * mismas validaciones, mismos mensajes de error y misma forma de los datos.
 * No depende de Angular, así que se puede probar con Node.
 */

export class LocalError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'LocalError';
  }
}

function fail(status: number, message: string): never {
  throw new LocalError(status, message);
}

export interface StoredTransaction {
  id: number;
  accountId: number;
  categoryId: number;
  amount: number;
  type: TxType;
  /** AAAA-MM-DD */
  date: string;
  note: string | null;
}

export interface StoredBudget {
  id: number;
  categoryId: number;
  /** AAAA-MM */
  month: string;
  limitAmount: number;
}

export interface LocalData {
  version: 1;
  currency: string;
  accounts: Account[];
  categories: Category[];
  transactions: StoredTransaction[];
  budgets: StoredBudget[];
}

export interface TransactionQuery {
  month?: string;
  accountId?: number | null;
  categoryId?: number | null;
  page?: number;
  pageSize?: number;
}

export interface ReportData {
  month: string;
  summary: Summary;
  txs: Transaction[];
  currency: string;
}

export const MAX_MONEY = 9_999_999_999.99;

export const DEFAULT_CATEGORIES: { name: string; type: TxType; color: string }[] = [
  { name: 'Nómina', type: 'INCOME', color: '#22c55e' },
  { name: 'Otros ingresos', type: 'INCOME', color: '#14b8a6' },
  { name: 'Comida', type: 'EXPENSE', color: '#ef4444' },
  { name: 'Transporte', type: 'EXPENSE', color: '#f97316' },
  { name: 'Vivienda', type: 'EXPENSE', color: '#8b5cf6' },
  { name: 'Ocio', type: 'EXPENSE', color: '#ec4899' },
  { name: 'Salud', type: 'EXPENSE', color: '#06b6d4' },
  { name: 'Compras', type: 'EXPENSE', color: '#eab308' },
  { name: 'Otros gastos', type: 'EXPENSE', color: '#64748b' },
];

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'MXN', 'ARS', 'COP', 'CLP', 'PEN'];

const ACCOUNT_TYPES: AccountType[] = ['BANK', 'CASH', 'SAVINGS'];
const TX_TYPES: TxType[] = ['INCOME', 'EXPENSE'];
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Datos iniciales: categorías por defecto y una cuenta principal. */
export function seedData(): LocalData {
  return {
    version: 1,
    currency: 'EUR',
    accounts: [{ id: 1, name: 'Cuenta principal', type: 'BANK', initialBalance: 0 }],
    categories: DEFAULT_CATEGORIES.map((c, i) => ({ id: i + 1, ...c, icon: null })),
    transactions: [],
    budgets: [],
  };
}

// ---------- Utilidades ----------

const cents = (n: number) => Math.round(n * 100);
const fromCents = (n: number) => n / 100;
const nextId = (list: { id: number }[]) => list.reduce((max, x) => Math.max(max, x.id), 0) + 1;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function compareDate(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function money(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(400, `${label}: número no válido`);
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded) > MAX_MONEY) fail(400, `${label}: importe demasiado grande`);
  return rounded;
}

function name(value: unknown, max: number): string {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) fail(400, 'name: el nombre es obligatorio');
  if (v.length > max) fail(400, `name: máximo ${max} caracteres`);
  return v;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (typeof value !== 'string' || !options.includes(value as T)) fail(400, `${label}: valor no válido`);
  return value as T;
}

// ---------- Validación de datos (carga y copias de seguridad) ----------

/** Valida y copia unos datos desconocidos (archivo importado o almacenamiento). */
export function parseLocalData(raw: unknown): LocalData {
  const bad = (msg: string): never => fail(400, `Copia de seguridad no válida: ${msg}`);
  if (!isObj(raw)) return bad('el archivo no contiene datos');
  if (raw['version'] !== 1) bad('versión desconocida');

  const currency = raw['currency'];
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) bad('moneda no válida');

  const list = (key: string): unknown[] => {
    const v = raw[key];
    if (!Array.isArray(v)) return bad(`falta "${key}"`);
    return v as unknown[];
  };
  const id = (v: unknown, where: string): number => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return bad(`id no válido en ${where}`);
    return v;
  };
  const unique = new Set<string>();
  const claim = (kind: string, n: number) => {
    const key = `${kind}:${n}`;
    if (unique.has(key)) bad(`id repetido en ${kind}`);
    unique.add(key);
  };

  const accounts: Account[] = list('accounts').map((a) => {
    if (!isObj(a)) return bad('cuenta no válida');
    const n = id(a['id'], 'cuentas');
    claim('cuentas', n);
    return {
      id: n,
      name: name(a['name'], 100),
      type: oneOf(a['type'], ACCOUNT_TYPES, 'type'),
      initialBalance: money(a['initialBalance'], 'initialBalance'),
    };
  });

  const categories: Category[] = list('categories').map((c) => {
    if (!isObj(c)) return bad('categoría no válida');
    const n = id(c['id'], 'categorías');
    claim('categorías', n);
    const color = c['color'];
    if (typeof color !== 'string' || !COLOR_RE.test(color)) bad('color de categoría no válido');
    const icon = c['icon'];
    return {
      id: n,
      name: name(c['name'], 60),
      type: oneOf(c['type'], TX_TYPES, 'type'),
      color: color as string,
      icon: typeof icon === 'string' ? icon.slice(0, 50) : null,
    };
  });

  const accountIds = new Set(accounts.map((a) => a.id));
  const categoryIds = new Set(categories.map((c) => c.id));

  const transactions: StoredTransaction[] = list('transactions').map((t) => {
    if (!isObj(t)) return bad('movimiento no válido');
    const n = id(t['id'], 'movimientos');
    claim('movimientos', n);
    const accountId = id(t['accountId'], 'movimientos');
    const categoryId = id(t['categoryId'], 'movimientos');
    if (!accountIds.has(accountId)) bad('un movimiento usa una cuenta que no existe');
    if (!categoryIds.has(categoryId)) bad('un movimiento usa una categoría que no existe');
    const date = normalizeDate(t['date']);
    if (!date) bad('fecha de movimiento no válida');
    const amount = money(t['amount'], 'amount');
    if (amount <= 0) bad('importe de movimiento no válido');
    const note = t['note'];
    return {
      id: n,
      accountId,
      categoryId,
      amount,
      type: oneOf(t['type'], TX_TYPES, 'type'),
      date: date as string,
      note: typeof note === 'string' && note ? note.slice(0, 500) : null,
    };
  });

  const budgets: StoredBudget[] = list('budgets').map((b) => {
    if (!isObj(b)) return bad('presupuesto no válido');
    const n = id(b['id'], 'presupuestos');
    claim('presupuestos', n);
    const categoryId = id(b['categoryId'], 'presupuestos');
    if (!categoryIds.has(categoryId)) bad('un presupuesto usa una categoría que no existe');
    if (!isMonth(b['month'])) bad('mes de presupuesto no válido');
    const limitAmount = money(b['limitAmount'], 'limitAmount');
    if (limitAmount <= 0) bad('límite de presupuesto no válido');
    return { id: n, categoryId, month: b['month'] as string, limitAmount };
  });

  return { version: 1, currency: currency as string, accounts, categories, transactions, budgets };
}

/** Interpreta el texto de un archivo de copia de seguridad. */
export function parseBackup(text: string): LocalData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail(400, 'Copia de seguridad no válida: el archivo no es JSON');
  }
  const body = isObj(parsed) && isObj(parsed['data']) ? parsed['data'] : parsed;
  return parseLocalData(body);
}

// ---------- Repositorio ----------

export class LocalRepo {
  constructor(
    private data: LocalData,
    private readonly persist: (data: LocalData) => Promise<void>,
  ) {}

  private async commit<T>(result: T): Promise<T> {
    await this.persist(this.data);
    return result;
  }

  /** Guarda el estado actual (p. ej. tras sembrar los datos iniciales). */
  save(): Promise<void> {
    return this.persist(this.data);
  }

  // ----- Ajustes -----

  get currency(): string {
    return this.data.currency;
  }

  async setCurrency(code: string): Promise<string> {
    if (!/^[A-Z]{3}$/.test(code)) fail(400, 'currency: moneda no válida');
    this.data.currency = code;
    return this.commit(code);
  }

  // ----- Cuentas -----

  accounts(): Account[] {
    return [...this.data.accounts].sort((a, b) => a.id - b.id).map((a) => ({ ...a }));
  }

  private accountInput(input: unknown) {
    const i = isObj(input) ? input : {};
    return {
      name: name(i['name'], 100),
      type: oneOf(i['type'], ACCOUNT_TYPES, 'type'),
      initialBalance: i['initialBalance'] === undefined ? 0 : money(i['initialBalance'], 'initialBalance'),
    };
  }

  async saveAccount(id: number | null, input: unknown): Promise<Account> {
    const v = this.accountInput(input);
    if (id === null) {
      const item: Account = { id: nextId(this.data.accounts), ...v };
      this.data.accounts.push(item);
      return this.commit({ ...item });
    }
    const found = this.data.accounts.find((a) => a.id === id);
    if (!found) fail(404, 'Cuenta no encontrada');
    Object.assign(found, v);
    return this.commit({ ...found });
  }

  /** Borrar una cuenta borra también sus movimientos (igual que ON DELETE CASCADE). */
  async deleteAccount(id: number): Promise<void> {
    const before = this.data.accounts.length;
    this.data.accounts = this.data.accounts.filter((a) => a.id !== id);
    if (this.data.accounts.length === before) fail(404, 'Cuenta no encontrada');
    this.data.transactions = this.data.transactions.filter((t) => t.accountId !== id);
    return this.commit(undefined);
  }

  // ----- Categorías -----

  categories(): Category[] {
    // En PostgreSQL el enum se ordena por declaración: INCOME antes que EXPENSE
    const rank: Record<TxType, number> = { INCOME: 0, EXPENSE: 1 };
    return [...this.data.categories]
      .sort((a, b) => rank[a.type] - rank[b.type] || a.name.localeCompare(b.name, 'es'))
      .map((c) => ({ ...c }));
  }

  private categoryInput(input: unknown) {
    const i = isObj(input) ? input : {};
    const color = i['color'] === undefined ? '#6366f1' : i['color'];
    if (typeof color !== 'string' || !COLOR_RE.test(color)) fail(400, 'color: color no válido');
    const icon = i['icon'];
    return {
      name: name(i['name'], 60),
      type: oneOf(i['type'], TX_TYPES, 'type'),
      color,
      icon: typeof icon === 'string' && icon ? icon.slice(0, 50) : null,
    };
  }

  async saveCategory(id: number | null, input: unknown): Promise<Category> {
    const v = this.categoryInput(input);
    if (id === null) {
      const item: Category = { id: nextId(this.data.categories), ...v };
      this.data.categories.push(item);
      return this.commit({ ...item });
    }
    const found = this.data.categories.find((c) => c.id === id);
    if (!found) fail(404, 'Categoría no encontrada');
    Object.assign(found, v);
    return this.commit({ ...found });
  }

  async deleteCategory(id: number): Promise<void> {
    if (this.data.transactions.some((t) => t.categoryId === id))
      fail(409, 'La categoría tiene movimientos asociados');
    const before = this.data.categories.length;
    this.data.categories = this.data.categories.filter((c) => c.id !== id);
    if (this.data.categories.length === before) fail(404, 'Categoría no encontrada');
    this.data.budgets = this.data.budgets.filter((b) => b.categoryId !== id);
    return this.commit(undefined);
  }

  /** Crea las categorías por defecto que aún no existan. */
  async createDefaultCategories(): Promise<{ created: number }> {
    const have = new Set(this.data.categories.map((c) => `${c.type}:${c.name}`));
    const missing = DEFAULT_CATEGORIES.filter((c) => !have.has(`${c.type}:${c.name}`));
    for (const c of missing) {
      this.data.categories.push({ id: nextId(this.data.categories), ...c, icon: null });
    }
    return this.commit({ created: missing.length });
  }

  // ----- Movimientos -----

  private toTransaction(t: StoredTransaction): Transaction {
    const category = this.data.categories.find((c) => c.id === t.categoryId);
    const account = this.data.accounts.find((a) => a.id === t.accountId);
    if (!category || !account) fail(500, 'Datos inconsistentes');
    return {
      id: t.id,
      accountId: t.accountId,
      categoryId: t.categoryId,
      amount: t.amount,
      type: t.type,
      // La API devuelve la fecha como medianoche UTC; la pantalla la formatea en UTC
      date: `${t.date}T00:00:00.000Z`,
      note: t.note,
      category: { ...category },
      account: { ...account },
    };
  }

  private transactionInput(input: unknown) {
    const i = isObj(input) ? input : {};
    const accountId = i['accountId'];
    const categoryId = i['categoryId'];
    if (typeof accountId !== 'number' || !Number.isInteger(accountId) || accountId < 1)
      fail(400, 'accountId: cuenta no válida');
    if (typeof categoryId !== 'number' || !Number.isInteger(categoryId) || categoryId < 1)
      fail(400, 'categoryId: categoría no válida');
    const amount = money(i['amount'], 'amount');
    if (amount <= 0) fail(400, 'amount: el importe debe ser mayor que 0');
    const type = oneOf(i['type'], TX_TYPES, 'type');
    const date = normalizeDate(i['date']);
    if (!date) fail(400, 'date: fecha no válida');
    const rawNote = typeof i['note'] === 'string' ? i['note'].trim() : '';
    if (rawNote.length > 500) fail(400, 'note: máximo 500 caracteres');

    if (!this.data.accounts.some((a) => a.id === accountId)) fail(400, 'Cuenta no válida');
    const category = this.data.categories.find((c) => c.id === categoryId);
    if (!category) fail(400, 'Categoría no válida');
    if (category.type !== type) fail(400, 'El tipo no coincide con la categoría');

    return { accountId, categoryId, amount, type, date: date as string, note: rawNote || null };
  }

  transactions(query: TransactionQuery): Page<Transaction> {
    if (query.month !== undefined && query.month !== '' && !isMonth(query.month))
      fail(400, 'month: mes no válido (usa AAAA-MM)');
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 20)));

    const filtered = this.data.transactions
      .filter(
        (t) =>
          (!query.month || t.date.startsWith(query.month)) &&
          (!query.accountId || t.accountId === query.accountId) &&
          (!query.categoryId || t.categoryId === query.categoryId),
      )
      .sort((a, b) => compareDate(b.date, a.date) || b.id - a.id);

    // Totales de todo el filtro, no solo de la página
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.type === 'INCOME') income += cents(t.amount);
      else expense += cents(t.amount);
    }

    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize).map((t) => this.toTransaction(t)),
      total: filtered.length,
      page,
      pageSize,
      totals: { income: fromCents(income), expense: fromCents(expense) },
    };
  }

  async saveTransaction(id: number | null, input: TransactionInput): Promise<Transaction> {
    const v = this.transactionInput(input);
    if (id === null) {
      const item: StoredTransaction = { id: nextId(this.data.transactions), ...v };
      this.data.transactions.push(item);
      return this.commit(this.toTransaction(item));
    }
    const found = this.data.transactions.find((t) => t.id === id);
    if (!found) fail(404, 'Movimiento no encontrado');
    Object.assign(found, v);
    return this.commit(this.toTransaction(found));
  }

  async deleteTransaction(id: number): Promise<void> {
    const before = this.data.transactions.length;
    this.data.transactions = this.data.transactions.filter((t) => t.id !== id);
    if (this.data.transactions.length === before) fail(404, 'Movimiento no encontrado');
    return this.commit(undefined);
  }

  // ----- Presupuestos -----

  /** Crea o actualiza el presupuesto de una categoría de gasto en un mes. */
  async setBudget(input: unknown): Promise<StoredBudget> {
    const i = isObj(input) ? input : {};
    const categoryId = i['categoryId'];
    if (typeof categoryId !== 'number' || !Number.isInteger(categoryId) || categoryId < 1)
      fail(400, 'categoryId: categoría no válida');
    if (!isMonth(i['month'])) fail(400, 'month: mes no válido (usa AAAA-MM)');
    const limitAmount = money(i['limitAmount'], 'limitAmount');
    if (limitAmount <= 0) fail(400, 'limitAmount: el límite debe ser mayor que 0');

    const isExpense = this.data.categories.some((c) => c.id === categoryId && c.type === 'EXPENSE');
    if (!isExpense) fail(400, 'Categoría de gasto no válida');

    const month = i['month'] as string;
    const existing = this.data.budgets.find((b) => b.categoryId === categoryId && b.month === month);
    if (existing) {
      existing.limitAmount = limitAmount;
      return this.commit({ ...existing });
    }
    const item: StoredBudget = { id: nextId(this.data.budgets), categoryId, month, limitAmount };
    this.data.budgets.push(item);
    return this.commit({ ...item });
  }

  async deleteBudget(id: number): Promise<void> {
    const before = this.data.budgets.length;
    this.data.budgets = this.data.budgets.filter((b) => b.id !== id);
    if (this.data.budgets.length === before) fail(404, 'Presupuesto no encontrado');
    return this.commit(undefined);
  }

  // ----- Estadísticas -----

  /** Resumen mensual: mismas cifras y misma forma que GET /api/stats/summary. */
  summary(month: string, now = new Date()): Summary {
    if (!isMonth(month)) fail(400, 'month: mes no válido (usa AAAA-MM)');
    const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));

    // Una sola pasada: ingresos/gastos por mes, gasto por categoría del mes y movimiento por cuenta
    const perMonth = new Map<string, { income: number; expense: number }>(
      months.map((m) => [m, { income: 0, expense: 0 }]),
    );
    const spentByCategory = new Map<number, number>();
    const movement = new Map<number, number>();

    for (const t of this.data.transactions) {
      const c = cents(t.amount);
      const bucket = perMonth.get(t.date.slice(0, 7));
      if (bucket) {
        if (t.type === 'INCOME') bucket.income += c;
        else bucket.expense += c;
      }
      if (t.type === 'EXPENSE' && t.date.startsWith(month)) {
        spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + c);
      }
      movement.set(t.accountId, (movement.get(t.accountId) ?? 0) + (t.type === 'INCOME' ? c : -c));
    }

    const series = months.map((m) => {
      const b = perMonth.get(m) ?? { income: 0, expense: 0 };
      return { month: m, income: fromCents(b.income), expense: fromCents(b.expense) };
    });
    const current = series.at(-1) ?? { month, income: 0, expense: 0 };
    const catById = new Map(this.data.categories.map((c) => [c.id, c] as const));

    const byCategory = [...spentByCategory.entries()]
      .map(([categoryId, total]) => {
        const c = catById.get(categoryId);
        return {
          categoryId,
          name: c?.name ?? '—',
          color: c?.color ?? '#64748b',
          total: round2(fromCents(total)),
        };
      })
      .sort((a, b) => b.total - a.total);

    const budgets = this.data.budgets
      .filter((b) => b.month === month)
      .sort((a, b) => a.id - b.id)
      .map((b) => {
        const c = catById.get(b.categoryId);
        const spent = fromCents(spentByCategory.get(b.categoryId) ?? 0);
        return {
          id: b.id,
          categoryId: b.categoryId,
          name: c?.name ?? '—',
          color: c?.color ?? '#64748b',
          limit: round2(b.limitAmount),
          spent: round2(spent),
          percent: budgetPercent(spent, b.limitAmount),
        };
      });

    const accounts = [...this.data.accounts]
      .sort((a, b) => a.id - b.id)
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: round2(a.initialBalance + fromCents(movement.get(a.id) ?? 0)),
      }));

    const today = localToday(now);
    const daysInMonth = daysInMonthOf(month);
    const daysElapsed = daysElapsedIn(month, today.month, today.day);
    const avgPrev3 = average(series.slice(2, 5).map((s) => s.expense));

    return {
      month,
      income: round2(current.income),
      expense: round2(current.expense),
      balance: round2(current.income - current.expense),
      totalBalance: round2(accounts.reduce((sum, a) => sum + a.balance, 0)),
      accounts,
      byCategory,
      budgets,
      monthly: series.map((s) => ({
        month: s.month,
        income: round2(s.income),
        expense: round2(s.expense),
      })),
      projection: {
        daysElapsed,
        daysInMonth,
        spentSoFar: round2(current.expense),
        projectedExpense: round2(projectExpense(current.expense, daysElapsed, daysInMonth)),
        avgPrev3Months: round2(avgPrev3),
      },
    };
  }

  // ----- Informes y copias de seguridad -----

  reportData(month: string, now = new Date()): ReportData {
    if (!isMonth(month)) fail(400, 'month: mes no válido (usa AAAA-MM)');
    const txs = this.data.transactions
      .filter((t) => t.date.startsWith(month))
      .sort((a, b) => compareDate(b.date, a.date) || b.id - a.id)
      .map((t) => this.toTransaction(t));
    return { month, summary: this.summary(month, now), txs, currency: this.data.currency };
  }

  /** Archivo de copia de seguridad (JSON). */
  exportJson(): string {
    return JSON.stringify(
      { app: 'finanzas-personales', exportedAt: new Date().toISOString(), data: this.data },
      null,
      2,
    );
  }

  /** Sustituye todos los datos por los de una copia de seguridad (se valida antes). */
  async importJson(text: string): Promise<void> {
    this.data = parseBackup(text);
    return this.commit(undefined);
  }

  /** Borra todo y vuelve a los datos iniciales. */
  async reset(): Promise<void> {
    this.data = seedData();
    return this.commit(undefined);
  }

  counts() {
    return {
      accounts: this.data.accounts.length,
      categories: this.data.categories.length,
      transactions: this.data.transactions.length,
      budgets: this.data.budgets.length,
    };
  }
}
