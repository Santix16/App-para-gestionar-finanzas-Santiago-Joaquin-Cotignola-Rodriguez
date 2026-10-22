import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, switchMap } from 'rxjs';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { ApiService, currentMonth, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Account, AccountType } from '../../core/models';

const TYPE_LABEL: Record<AccountType, string> = {
  BANK: 'Banco',
  CASH: 'Efectivo',
  SAVINGS: 'Ahorro',
};
const TYPE_ICON: Record<AccountType, string> = {
  BANK: 'account_balance',
  CASH: 'payments',
  SAVINGS: 'savings',
};

@Component({
  selector: 'app-accounts',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.scss',
})
export class AccountsComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);

  readonly accounts = signal<Account[]>([]);
  readonly balances = signal<Record<number, number | undefined>>({});
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly currency = computed(() => this.auth.user()?.currency ?? 'EUR');

  readonly typeLabel = TYPE_LABEL;
  readonly typeIcon = TYPE_ICON;
  readonly types: AccountType[] = ['BANK', 'CASH', 'SAVINGS'];

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', Validators.required),
    type: this.fb.nonNullable.control<AccountType>('BANK'),
    initialBalance: this.fb.nonNullable.control(0),
  });

  constructor() {
    this.load();
  }

  load() {
    this.api.accounts().subscribe((a) => this.accounts.set(a));
    this.api.summary(currentMonth()).subscribe({
      next: (s) => this.balances.set(Object.fromEntries(s.accounts.map((a) => [a.id, a.balance]))),
      error: () => undefined,
    });
  }

  edit(a: Account) {
    this.editingId.set(a.id);
    this.form.setValue({ name: a.name, type: a.type, initialBalance: a.initialBalance });
  }

  reset() {
    this.editingId.set(null);
    this.form.reset({ name: '', type: 'BANK', initialBalance: 0 });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.api
      .saveAccount(this.editingId(), { ...v, initialBalance: Number(v.initialBalance) })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open('Cuenta guardada', undefined, { duration: 2000 });
          this.reset();
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.snack.open(errorMessage(err), 'Cerrar', { duration: 4000 });
        },
      });
  }

  remove(a: Account) {
    this.confirm
      .ask({
        title: 'Eliminar cuenta',
        message: `¿Eliminar la cuenta "${a.name}"? También se borrarán sus movimientos.`,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.deleteAccount(a.id)),
      )
      .subscribe({
        next: () => {
          this.snack.open('Cuenta eliminada', undefined, { duration: 2000 });
          this.load();
        },
        error: (err) => this.snack.open(errorMessage(err), 'Cerrar', { duration: 4000 }),
      });
  }
}
