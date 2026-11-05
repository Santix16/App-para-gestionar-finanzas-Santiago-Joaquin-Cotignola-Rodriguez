import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, defer, throwError } from 'rxjs';
import type { TransactionFilters } from '../api.service';
import type {
  Account,
  AccountType,
  Category,
  Page,
  Summary,
  Transaction,
  TransactionInput,
  TxType,
} from '../models';
import { saveFile } from './file-saver';
import { LocalError, LocalRepo } from './local-repo';
import { LOCAL_STORE } from './store.token';

/** Convierte los errores locales en HttpErrorResponse para que errorMessage() los entienda igual. */
function toHttpError(err: unknown): HttpErrorResponse {
  if (err instanceof LocalError) {
    return new HttpErrorResponse({ status: err.status, error: { error: err.message } });
  }
  console.error(err);
  return new HttpErrorResponse({
    status: 500,
    error: { error: 'No se pudo acceder a los datos del dispositivo' },
  });
}

/**
 * Sustituye a ApiService en la APK: mismos métodos y mismas respuestas,
 * pero los datos se leen y se guardan en el propio móvil (sin servidor).
 */
@Injectable({ providedIn: 'root' })
export class LocalApiService {
  private readonly store = inject(LOCAL_STORE);

  private op<T>(fn: (repo: LocalRepo) => T | Promise<T>): Observable<T> {
    return defer(async () => fn(await this.store.ready)).pipe(
      catchError((err) => throwError(() => toHttpError(err))),
    );
  }

  // Cuentas
  accounts(): Observable<Account[]> {
    return this.op((r) => r.accounts());
  }
  saveAccount(
    id: number | null,
    data: { name: string; type: AccountType; initialBalance: number },
  ): Observable<object> {
    return this.op((r) => r.saveAccount(id, data));
  }
  deleteAccount(id: number): Observable<object> {
    return this.op(async (r) => {
      await r.deleteAccount(id);
      return {};
    });
  }

  // Categorías
  categories(): Observable<Category[]> {
    return this.op((r) => r.categories());
  }
  saveCategory(
    id: number | null,
    data: { name: string; type: TxType; color: string },
  ): Observable<object> {
    return this.op((r) => r.saveCategory(id, data));
  }
  deleteCategory(id: number): Observable<object> {
    return this.op(async (r) => {
      await r.deleteCategory(id);
      return {};
    });
  }
  createDefaultCategories(): Observable<{ created: number }> {
    return this.op((r) => r.createDefaultCategories());
  }

  // Movimientos (paginados)
  transactions(filters: TransactionFilters): Observable<Page<Transaction>> {
    return this.op((r) => r.transactions(filters));
  }
  saveTransaction(id: number | null, data: TransactionInput): Observable<object> {
    return this.op((r) => r.saveTransaction(id, data));
  }
  deleteTransaction(id: number): Observable<object> {
    return this.op(async (r) => {
      await r.deleteTransaction(id);
      return {};
    });
  }

  // Presupuestos
  setBudget(data: { categoryId: number; month: string; limitAmount: number }): Observable<object> {
    return this.op((r) => r.setBudget(data));
  }
  deleteBudget(id: number): Observable<object> {
    return this.op(async (r) => {
      await r.deleteBudget(id);
      return {};
    });
  }

  // Estadísticas e informes
  summary(month: string): Observable<Summary> {
    return this.op((r) => r.summary(month));
  }
  downloadReport(kind: 'pdf' | 'excel', month: string): Observable<void> {
    return this.op(async (r) => {
      const data = r.reportData(month);
      // Las librerías de PDF y Excel se cargan solo cuando se pide un informe
      const reports = await import('./local-reports');
      const file = kind === 'pdf' ? await reports.buildPdf(data) : await reports.buildExcel(data);
      await saveFile(file.filename, file.blob);
    });
  }
}
