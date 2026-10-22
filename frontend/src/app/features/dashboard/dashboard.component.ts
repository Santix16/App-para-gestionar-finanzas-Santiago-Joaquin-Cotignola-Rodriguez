import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService, currentMonth } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Summary } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { MonthPickerComponent } from '../../shared/month-picker.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    CurrencyPipe,
    BaseChartDirective,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MonthPickerComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  private readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);

  readonly month = signal(currentMonth());
  readonly summary = signal<Summary | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);

  readonly currency = computed(() => this.auth.user()?.currency ?? 'EUR');

  private readonly textColor = computed(() => (this.theme.isDark() ? '#e6e0e9' : '#1d1b20'));
  private readonly gridColor = computed(() =>
    this.theme.isDark() ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
  );

  constructor() {
    effect(() => {
      const month = this.month();
      this.loading.set(true);
      this.failed.set(false);
      this.api.summary(month).subscribe({
        next: (s) => {
          this.summary.set(s);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
    });
  }

  // Gráfica de gasto por categoría
  readonly doughnutData = computed<ChartData<'doughnut'>>(() => {
    const s = this.summary();
    return {
      labels: s?.byCategory.map((c) => c.name) ?? [],
      datasets: [
        {
          data: s?.byCategory.map((c) => c.total) ?? [],
          backgroundColor: s?.byCategory.map((c) => c.color) ?? [],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly doughnutOptions = computed<ChartConfiguration<'doughnut'>['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: { legend: { position: 'bottom', labels: { color: this.textColor() } } },
  }));

  // Evolución mensual
  readonly barData = computed<ChartData<'bar'>>(() => {
    const s = this.summary();
    const fmt = new Intl.DateTimeFormat('es-ES', { month: 'short' });
    return {
      labels:
        s?.monthly.map((m) => {
          const [y, mo] = m.month.split('-').map(Number);
          return fmt.format(new Date(y, mo - 1, 1));
        }) ?? [],
      datasets: [
        {
          label: 'Ingresos',
          data: s?.monthly.map((m) => m.income) ?? [],
          backgroundColor: '#4caf7a',
        },
        {
          label: 'Gastos',
          data: s?.monthly.map((m) => m.expense) ?? [],
          backgroundColor: '#e5686a',
        },
      ],
    };
  });

  readonly barOptions = computed<ChartConfiguration<'bar'>['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: this.textColor() } } },
    scales: {
      x: { ticks: { color: this.textColor() }, grid: { display: false } },
      y: {
        ticks: { color: this.textColor() },
        grid: { color: this.gridColor() },
        beginAtZero: true,
      },
    },
  }));

  cap(percent: number) {
    return Math.min(percent, 100);
  }

  level(percent: number): 'ok' | 'near' | 'over' {
    if (percent >= 100) return 'over';
    if (percent >= 80) return 'near';
    return 'ok';
  }
}
