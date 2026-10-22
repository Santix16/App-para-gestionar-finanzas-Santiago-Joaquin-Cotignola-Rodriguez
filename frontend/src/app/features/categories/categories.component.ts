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
import { ApiService, errorMessage } from '../../core/api.service';
import { Category, TxType } from '../../core/models';

@Component({
  selector: 'app-categories',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly confirm = inject(ConfirmService);

  readonly categories = signal<Category[]>([]);
  readonly loaded = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);

  readonly expenses = computed(() => this.categories().filter((c) => c.type === 'EXPENSE'));
  readonly incomes = computed(() => this.categories().filter((c) => c.type === 'INCOME'));

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', Validators.required),
    type: this.fb.nonNullable.control<TxType>('EXPENSE'),
    color: this.fb.nonNullable.control('#6366f1'),
  });

  constructor() {
    this.load();
  }

  load() {
    this.api.categories().subscribe((c) => {
      this.categories.set(c);
      this.loaded.set(true);
    });
  }

  edit(c: Category) {
    this.editingId.set(c.id);
    this.form.setValue({ name: c.name, type: c.type, color: c.color });
  }

  reset() {
    this.editingId.set(null);
    this.form.reset({ name: '', type: 'EXPENSE', color: '#6366f1' });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.saveCategory(this.editingId(), this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('Categoría guardada', undefined, { duration: 2000 });
        this.reset();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.snack.open(errorMessage(err), 'Cerrar', { duration: 4000 });
      },
    });
  }

  remove(c: Category) {
    this.confirm
      .ask({ title: 'Eliminar categoría', message: `¿Eliminar la categoría "${c.name}"?` })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.deleteCategory(c.id)),
      )
      .subscribe({
        next: () => {
          this.snack.open('Categoría eliminada', undefined, { duration: 2000 });
          this.load();
        },
        error: (err) => this.snack.open(errorMessage(err), 'Cerrar', { duration: 4000 }),
      });
  }

  loadDefaults() {
    this.api.createDefaultCategories().subscribe({
      next: (r) => {
        this.snack.open(`Se han creado ${r.created} categorías`, undefined, { duration: 2500 });
        this.load();
      },
      error: (err) => this.snack.open(errorMessage(err), 'Cerrar', { duration: 4000 }),
    });
  }
}
