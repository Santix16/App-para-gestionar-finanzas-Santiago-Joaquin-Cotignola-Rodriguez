import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { saveFile } from '../../core/local/file-saver';
import { LocalAuthService } from '../../core/local/local-auth.service';
import { CURRENCIES, LocalError, LocalRepo } from '../../core/local/local-repo';
import { LOCAL_STORE } from '../../core/local/store.token';
import { ConfirmService } from '../../shared/confirm-dialog.component';

/** Ajustes de la versión local: moneda, copia de seguridad y borrado de datos. */
@Component({
  selector: 'app-settings',
  imports: [MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatSelectModule],
  template: `
    <div class="page-header">
      <h1>Ajustes</h1>
    </div>

    <div class="grid-2">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Moneda</mat-card-title>
          <mat-card-subtitle>Se usa para mostrar los importes</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Moneda</mat-label>
            <mat-select [value]="currency()" (selectionChange)="changeCurrency($event.value)">
              @for (c of currencies; track c) {
                <mat-option [value]="c">{{ c }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Copia de seguridad</mat-card-title>
          <mat-card-subtitle>
            Tus datos están solo en este móvil. Si desinstalas la app, se borran.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p class="counts">
            {{ counts().transactions }} movimientos · {{ counts().accounts }} cuentas ·
            {{ counts().categories }} categorías · {{ counts().budgets }} presupuestos
          </p>
        </mat-card-content>
        <mat-card-actions>
          <button mat-flat-button type="button" [disabled]="busy()" (click)="exportData()">
            <mat-icon>download</mat-icon> Exportar copia
          </button>
          <button mat-stroked-button type="button" [disabled]="busy()" (click)="file.click()">
            <mat-icon>upload</mat-icon> Importar copia
          </button>
          <input
            #file
            type="file"
            hidden
            accept="application/json,.json"
            aria-label="Archivo de copia de seguridad"
            (change)="importData($event)"
          />
        </mat-card-actions>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Borrar todos los datos</mat-card-title>
          <mat-card-subtitle>Vuelve al estado inicial de la app</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
          <button mat-stroked-button type="button" [disabled]="busy()" (click)="resetData()">
            <mat-icon>delete_forever</mat-icon> Borrar todo
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: `
    .counts {
      margin: 0;
      opacity: 0.8;
    }
    mat-card-actions {
      gap: 8px;
      flex-wrap: wrap;
    }
  `,
})
export class SettingsComponent implements OnInit {
  private readonly store = inject(LOCAL_STORE);
  private readonly auth = inject(LocalAuthService);
  private readonly snack = inject(MatSnackBar);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  readonly currencies = CURRENCIES;
  readonly currency = signal('EUR');
  readonly counts = signal({ accounts: 0, categories: 0, transactions: 0, budgets: 0 });
  readonly busy = signal(false);

  ngOnInit() {
    void this.refresh();
  }

  private async repo(): Promise<LocalRepo> {
    return this.store.ready;
  }

  private async refresh() {
    const repo = await this.repo();
    this.currency.set(repo.currency);
    this.counts.set(repo.counts());
  }

  private message(err: unknown, fallback: string) {
    return err instanceof LocalError ? err.message : fallback;
  }

  async changeCurrency(code: string) {
    try {
      await (await this.repo()).setCurrency(code);
      await this.auth.reloadUser();
      this.currency.set(code);
      this.snack.open('Moneda actualizada', undefined, { duration: 2000 });
    } catch (err) {
      this.snack.open(this.message(err, 'No se pudo cambiar la moneda'), 'Cerrar', { duration: 4000 });
    }
  }

  async exportData() {
    this.busy.set(true);
    try {
      const repo = await this.repo();
      const date = new Date();
      const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const blob = new Blob([repo.exportJson()], { type: 'application/json' });
      await saveFile(`finanzas-copia-${stamp}.json`, blob);
    } catch (err) {
      this.snack.open(this.message(err, 'No se pudo exportar la copia'), 'Cerrar', { duration: 4000 });
    } finally {
      this.busy.set(false);
    }
  }

  async importData(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite elegir de nuevo el mismo archivo
    if (!file) return;

    const ok = await firstValueFrom(
      this.confirm.ask({
        title: 'Importar copia de seguridad',
        message: 'Se reemplazarán todos los datos actuales por los del archivo. ¿Continuar?',
        confirmText: 'Importar',
      }),
    );
    if (!ok) return;

    this.busy.set(true);
    try {
      await (await this.repo()).importJson(await file.text());
      await this.auth.reloadUser();
      await this.refresh();
      this.snack.open('Copia importada', undefined, { duration: 2500 });
      await this.router.navigate(['/dashboard']);
    } catch (err) {
      this.snack.open(this.message(err, 'No se pudo importar el archivo'), 'Cerrar', { duration: 5000 });
    } finally {
      this.busy.set(false);
    }
  }

  async resetData() {
    const ok = await firstValueFrom(
      this.confirm.ask({
        title: 'Borrar todos los datos',
        message: 'Se borrarán cuentas, categorías, movimientos y presupuestos. No se puede deshacer.',
        confirmText: 'Borrar todo',
      }),
    );
    if (!ok) return;

    this.busy.set(true);
    try {
      await (await this.repo()).reset();
      await this.auth.reloadUser();
      await this.refresh();
      this.snack.open('Datos borrados', undefined, { duration: 2500 });
    } catch (err) {
      this.snack.open(this.message(err, 'No se pudieron borrar los datos'), 'Cerrar', { duration: 4000 });
    } finally {
      this.busy.set(false);
    }
  }
}
