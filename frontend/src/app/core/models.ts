export type TxType = 'INCOME' | 'EXPENSE';
export type AccountType = 'BANK' | 'CASH' | 'SAVINGS';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  initialBalance: number;
}

export interface Category {
  id: number;
  name: string;
  type: TxType;
  color: string;
  icon?: string | null;
}

export interface Transaction {
  id: number;
  accountId: number;
  categoryId: number;
  amount: number;
  type: TxType;
  date: string;
  note: string | null;
  category: Category;
  account: Account;
}

export interface TransactionInput {
  accountId: number;
  categoryId: number;
  amount: number;
  type: TxType;
  date: string;
  note?: string;
}

/** Respuesta paginada de GET /transactions */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  /** Totales de TODO el filtro, no solo de la página actual */
  totals: { income: number; expense: number };
}

export interface Summary {
  month: string;
  income: number;
  expense: number;
  balance: number;
  totalBalance: number;
  accounts: { id: number; name: string; type: AccountType; balance: number }[];
  byCategory: { categoryId: number; name: string; color: string; total: number }[];
  budgets: {
    id: number;
    categoryId: number;
    name: string;
    color: string;
    limit: number;
    spent: number;
    percent: number;
  }[];
  monthly: { month: string; income: number; expense: number }[];
  projection: {
    daysElapsed: number;
    daysInMonth: number;
    spentSoFar: number;
    projectedExpense: number;
    avgPrev3Months: number;
  };
}
