import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { filter, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService, currentMonth, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Account, Category, Transaction } from '../../core/models';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { MonthPickerComponent } from '../../shared/month-picker.component';
import { PaginatorEs } from '../../shared/paginator-es';
import { TransactionDialogComponent, TransactionDialogData } from './transaction-dialog.component';

@Component({
  selector: 'app-transactions',
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    MonthPickerComponent,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorEs }],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss',
})
export class TransactionsComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly confirm = inject(ConfirmService);
  readonly auth = inject(AuthService);

  // Filtros
  readonly month = signal(currentMonth());
  readonly accountId = signal<number | null>(null);
  readonly categoryId = signal<number | null>(null);

  // Paginación (la página empieza en 1; el paginador de Material, en 0)
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);

  readonly items = signal<Transaction[]>([]);
  readonly totals = signal({ income: 0, expense: 0 });
  readonly accounts = signal<Account[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);

  readonly columns = ['date', 'category', 'account', 'note', 'amount', 'actions'];
  readonly currency = computed(() => this.auth.user()?.currency ?? 'EUR');

  private readonly filterKey = computed(
    () => `${this.month()}|${this.accountId()}|${this.categoryId()}`,
  );
  private lastKey = this.filterKey();

  constructor() {
    this.api.accounts().subscribe((a) => this.accounts.set(a));
    this.api.categories().subscribe((c) => this.categories.set(c));

    effect(() => {
      const key = this.filterKey();
      const page = this.page();
      this.pageSize();

      // Al cambiar un filtro se vuelve a la primera página
      if (key !== this.lastKey) {
        this.lastKey = key;
        if (page !== 1) {
          this.page.set(1);
          return;
        }
      }
      this.load();
    });
  }

  private load() {
    this.loading.set(true);
    this.api
      .transactions({
        month: this.month(),
        accountId: this.accountId(),
        categoryId: this.categoryId(),
        page: this.page(),
        pageSize: this.pageSize(),
      })
      .subscribe({
        next: (res) => {
          // Si se borró el último elemento de la última página, retrocede una
          if (res.items.length === 0 && res.total > 0 && this.page() > 1) {
            this.page.update((p) => p - 1);
            return;
          }
          this.items.set(res.items);
          this.total.set(res.total);
          this.totals.set(res.totals);
          this.loading.set(false);
        },
        error: (err) => {
          this.snack.open(errorMessage(err), 'Cerrar', { duration: 4000 });
          this.loading.set(false);
        },
      });
  }

  onPage(event: PageEvent) {
    this.pageSize.set(event.pageSize);
    this.page.set(event.pageIndex + 1);
  }

  open(tx: Transaction | null) {
    if (this.accounts().length === 0 || this.categories().length === 0) {
      this.snack.open('Primero crea al menos una cuenta y una categoría.', 'Cerrar', {
        duration: 5000,
      });
      return;
    }
    const data: TransactionDialogData = {
      tx,
      accounts: this.accounts(),
      categories: this.categories(),
    };
    this.dialog
      .open<TransactionDialogComponent, TransactionDialogData, boolean>(
        TransactionDialogComponent,
        {
          data,
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snack.open('Movimiento guardado', undefined, { duration: 2000 });
          this.load();
        }
      });
  }

  remove(tx: Transaction) {
    this.confirm
      .ask({ title: 'Eliminar movimiento', message: '¿Eliminar este movimiento?' })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.deleteTransaction(tx.id)),
      )
      .subscribe({
        next: () => {
          this.snack.open('Movimiento eliminado', undefined, { duration: 2000 });
          this.load();
        },
        error: (err) => this.snack.open(errorMessage(err), 'Cerrar', { duration: 4000 }),
      });
  }
}
