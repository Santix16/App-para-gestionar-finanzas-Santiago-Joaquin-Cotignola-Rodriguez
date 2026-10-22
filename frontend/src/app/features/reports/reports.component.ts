import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService, currentMonth, errorMessage } from '../../core/api.service';
import { MonthPickerComponent } from '../../shared/month-picker.component';

@Component({
  selector: 'app-reports',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MonthPickerComponent],
  template: `
    <div class="page-header">
      <h1>Informes</h1>
      <app-month-picker [(month)]="month" />
    </div>

    <div class="grid-2">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Informe en PDF</mat-card-title>
          <mat-card-subtitle>Resumen, gasto por categoría, presupuestos y movimientos</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
          <button mat-flat-button type="button" [disabled]="busy()" (click)="download('pdf')">
            <mat-icon>picture_as_pdf</mat-icon> Descargar PDF
          </button>
        </mat-card-actions>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Exportar a Excel</mat-card-title>
          <mat-card-subtitle>Hoja de resumen y hoja con todos los movimientos</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
          <button mat-flat-button type="button" [disabled]="busy()" (click)="download('excel')">
            <mat-icon>table_view</mat-icon> Descargar Excel
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
})
export class ReportsComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly month = signal(currentMonth());
  readonly busy = signal(false);

  download(kind: 'pdf' | 'excel') {
    this.busy.set(true);
    this.api.downloadReport(kind, this.month()).subscribe({
      next: () => this.busy.set(false),
      error: (err) => {
        this.busy.set(false);
        this.snack.open(errorMessage(err, 'No se pudo generar el informe'), 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }
}
