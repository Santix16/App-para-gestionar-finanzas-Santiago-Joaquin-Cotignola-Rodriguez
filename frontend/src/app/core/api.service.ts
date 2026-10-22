import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_URL } from './api.config';
import {
  Account,
  AccountType,
  Category,
  Page,
  Summary,
  Transaction,
  TransactionInput,
  TxType,
} from './models';

// Prisma serializa los Decimal como texto: los convertimos a número aquí.
interface RawAccount extends Omit<Account, 'initialBalance'> {
  initialBalance: string | number;
}
interface RawTransaction extends Omit<Transaction, 'amount' | 'account'> {
  amount: string | number;
  account: RawAccount;
}
type RawPage = Omit<Page<RawTransaction>, 'items'> & { items: RawTransaction[] };

const toAccount = (a: RawAccount): Account => ({ ...a, initialBalance: Number(a.initialBalance) });

export interface TransactionFilters {
  month?: string;
  accountId?: number | null;
  categoryId?: number | null;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // Cuentas
  accounts() {
    return this.http
      .get<RawAccount[]>(`${API_URL}/accounts`)
      .pipe(map((list) => list.map(toAccount)));
  }
  saveAccount(
    id: number | null,
    data: { name: string; type: AccountType; initialBalance: number },
  ) {
    return id
      ? this.http.put(`${API_URL}/accounts/${id}`, data)
      : this.http.post(`${API_URL}/accounts`, data);
  }
  deleteAccount(id: number) {
    return this.http.delete(`${API_URL}/accounts/${id}`);
  }

  // Categorías
  categories() {
    return this.http.get<Category[]>(`${API_URL}/categories`);
  }
  saveCategory(id: number | null, data: { name: string; type: TxType; color: string }) {
    return id
      ? this.http.put(`${API_URL}/categories/${id}`, data)
      : this.http.post(`${API_URL}/categories`, data);
  }
  deleteCategory(id: number) {
    return this.http.delete(`${API_URL}/categories/${id}`);
  }
  createDefaultCategories() {
    return this.http.post<{ created: number }>(`${API_URL}/categories/defaults`, {});
  }

  // Movimientos (paginados)
  transactions(filters: TransactionFilters) {
    let params = new HttpParams();
    if (filters.month) params = params.set('month', filters.month);
    if (filters.accountId) params = params.set('accountId', filters.accountId);
    if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
    params = params.set('page', filters.page ?? 1).set('pageSize', filters.pageSize ?? 20);

    return this.http.get<RawPage>(`${API_URL}/transactions`, { params }).pipe(
      map((res): Page<Transaction> => ({
        ...res,
        items: res.items.map((t): Transaction => ({
          ...t,
          amount: Number(t.amount),
          account: toAccount(t.account),
        })),
      })),
    );
  }
  saveTransaction(id: number | null, data: TransactionInput) {
    return id
      ? this.http.put(`${API_URL}/transactions/${id}`, data)
      : this.http.post(`${API_URL}/transactions`, data);
  }
  deleteTransaction(id: number) {
    return this.http.delete(`${API_URL}/transactions/${id}`);
  }

  // Presupuestos
  setBudget(data: { categoryId: number; month: string; limitAmount: number }) {
    return this.http.put(`${API_URL}/budgets`, data);
  }
  deleteBudget(id: number) {
    return this.http.delete(`${API_URL}/budgets/${id}`);
  }

  // Estadísticas e informes
  summary(month: string) {
    return this.http.get<Summary>(`${API_URL}/stats/summary`, { params: { month } });
  }
  downloadReport(kind: 'pdf' | 'excel', month: string) {
    return this.http
      .get(`${API_URL}/reports/${kind}`, { params: { month }, responseType: 'blob' })
      .pipe(
        map((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `finanzas-${month}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`;
          a.click();
          URL.revokeObjectURL(url);
        }),
      );
  }
}

export function errorMessage(err: unknown, fallback = 'Ha ocurrido un error'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No se puede conectar con el servidor';
    if (err.status === 429) return err.error?.error ?? 'Demasiadas peticiones, espera un momento';
    return err.error?.error ?? fallback;
  }
  return fallback;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
