import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LOCAL_MODE } from '../../core/app-mode';
import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  readonly localMode = LOCAL_MODE;

  readonly items = [
    { path: '/dashboard', label: 'Resumen', icon: 'dashboard' },
    { path: '/transactions', label: 'Movimientos', icon: 'receipt_long' },
    { path: '/accounts', label: 'Cuentas', icon: 'account_balance' },
    { path: '/categories', label: 'Categorías', icon: 'category' },
    { path: '/budgets', label: 'Presupuestos', icon: 'savings' },
    { path: '/reports', label: 'Informes', icon: 'description' },
    ...(LOCAL_MODE ? [{ path: '/settings', label: 'Ajustes', icon: 'settings' }] : []),
  ];
}
