import { Component, computed, model } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-month-picker',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="picker">
      <button mat-icon-button type="button" aria-label="Mes anterior" (click)="shift(-1)">
        <mat-icon>chevron_left</mat-icon>
      </button>
      <span class="label">{{ label() }}</span>
      <button mat-icon-button type="button" aria-label="Mes siguiente" (click)="shift(1)">
        <mat-icon>chevron_right</mat-icon>
      </button>
    </div>
  `,
  styles: `
    .picker {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 999px;
      padding: 2px 4px;
    }
    .label {
      min-width: 140px;
      text-align: center;
      text-transform: capitalize;
      font-weight: 500;
    }
  `,
})
export class MonthPickerComponent {
  /** Formato "YYYY-MM". Se usa con [(month)]="signal" */
  readonly month = model.required<string>();

  readonly label = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(
      new Date(y, m - 1, 1),
    );
  });

  shift(delta: number) {
    const [y, m] = this.month().split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    this.month.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
}
