import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, switchMap } from 'rxjs';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { ApiService, currentMonth, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Category, Summary } from '../../core/models';
import { MonthPickerComponent } from '../../shared/month-picker.component';

@Component({
  selector: 'app-budgets',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MonthPickerComponent,
  ],
  templateUrl: './budgets.component.html',
  styleUrl: './budgets.component.scss',
})
export class BudgetsComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);

  readonly month = signal(currentMonth());
  readonly summary = signal<Summary | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly saving = signal(false);
  readonly currency = computed(() => this.auth.user()?.currency ?? 'EUR');
  readonly expenseCategories = computed(() =>
    this.categories().filter((c) => c.type === 'EXPENSE'),
  );

  readonly form = this.fb.group({
    categoryId: this.fb.control<number | null>(null, Validators.required),
    limitAmount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });

  constructor() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    effect(() => this.load(this.month()));
  }

  private load(month: string) {
    this.api.summary(month).subscribe((s) => this.summary.set(s));
  }

  cap(p: number) {
    return Math.min(p, 100);
  }

  level(p: number): 'ok' | 'near' | 'over' {
    if (p >= 100) return 'over';
    if (p >= 80) return 'near';
    return 'ok';
  }

  edit(categoryId: number, limit: number) {
    this.form.setValue({ categoryId, limitAmount: limit });
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .setBudget({
        categoryId: Number(v.categoryId),
        month: this.month(),
        limitAmount: Number(v.limitAmount),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open('Presupuesto guardado', undefined, { duration: 2000 });
          this.form.reset();
          this.load(this.month());
        },
        error: (err) => {
          this.saving.set(false);
          this.snack.open(errorMessage(err), 'Cerrar', { duration: 4000 });
        },
      });
  }

  remove(id: number) {
    this.confirm
      .ask({ title: 'Eliminar presupuesto', message: '¿Eliminar este presupuesto?' })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.deleteBudget(id)),
      )
      .subscribe({
        next: () => this.load(this.month()),
        error: (err) => this.snack.open(errorMessage(err), 'Cerrar', { duration: 4000 }),
      });
  }
}
