import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService, errorMessage } from '../../core/api.service';
import { Account, Category, Transaction, TxType } from '../../core/models';

export interface TransactionDialogData {
  tx: Transaction | null;
  accounts: Account[];
  categories: Category[];
}

@Component({
  selector: 'app-transaction-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.tx ? 'Editar movimiento' : 'Nuevo movimiento' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <mat-button-toggle-group formControlName="type" aria-label="Tipo de movimiento">
          <mat-button-toggle value="EXPENSE">Gasto</mat-button-toggle>
          <mat-button-toggle value="INCOME">Ingreso</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field appearance="outline">
          <mat-label>Importe</mat-label>
          <input matInput type="number" step="0.01" min="0.01" formControlName="amount" />
          @if (form.controls.amount.touched && form.controls.amount.invalid) {
            <mat-error>Introduce un importe mayor que 0</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fecha</mat-label>
          <input matInput type="date" formControlName="date" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Cuenta</mat-label>
          <mat-select formControlName="accountId">
            @for (a of data.accounts; track a.id) {
              <mat-option [value]="a.id">{{ a.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Categoría</mat-label>
          <mat-select formControlName="categoryId">
            @for (c of categories(); track c.id) {
              <mat-option [value]="c.id">{{ c.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Nota (opcional)</mat-label>
          <input matInput type="text" formControlName="note" />
        </mat-form-field>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || saving()">Guardar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: min(420px, 80vw);
      padding-top: 8px !important;
    }
    .error {
      color: var(--mat-sys-error);
      margin: 0;
    }
  `,
})
export class TransactionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly ref = inject(MatDialogRef<TransactionDialogComponent, boolean>);
  readonly data = inject<TransactionDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    type: this.fb.nonNullable.control<TxType>(this.data.tx?.type ?? 'EXPENSE'),
    amount: this.fb.control<number | null>(this.data.tx?.amount ?? null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    date: this.fb.nonNullable.control(
      this.data.tx?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      Validators.required,
    ),
    accountId: this.fb.control<number | null>(
      this.data.tx?.accountId ?? this.data.accounts[0]?.id ?? null,
      Validators.required,
    ),
    categoryId: this.fb.control<number | null>(this.data.tx?.categoryId ?? null, Validators.required),
    note: this.fb.nonNullable.control(this.data.tx?.note ?? ''),
  });

  private readonly type = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });

  readonly categories = computed(() => this.data.categories.filter((c) => c.type === this.type()));

  constructor() {
    // Si cambia el tipo y la categoría elegida ya no encaja, se limpia
    this.form.controls.type.valueChanges.subscribe(() => {
      const id = this.form.controls.categoryId.value;
      if (id && !this.categories().some((c) => c.id === id)) {
        this.form.controls.categoryId.setValue(null);
      }
    });
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);

    this.api
      .saveTransaction(this.data.tx?.id ?? null, {
        type: v.type,
        amount: Number(v.amount),
        date: v.date,
        accountId: Number(v.accountId),
        categoryId: Number(v.categoryId),
        note: v.note || undefined,
      })
      .subscribe({
        next: () => this.ref.close(true),
        error: (err) => {
          this.error.set(errorMessage(err, 'No se pudo guardar'));
          this.saving.set(false);
        },
      });
  }
}
