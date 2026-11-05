import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import type { User } from '../auth.service';
import { LOCAL_STORE } from './store.token';

/**
 * Sustituye a AuthService en la APK: no hay cuentas ni inicio de sesión.
 * La app abre directamente con el usuario local.
 */
@Injectable({ providedIn: 'root' })
export class LocalAuthService {
  private readonly store = inject(LOCAL_STORE);

  readonly token = signal<string | null>(null);
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => !!this.token());

  /** Abre el almacén local antes de mostrar ninguna pantalla. */
  async restoreSession(): Promise<void> {
    const repo = await this.store.ready;
    this.user.set({ id: 1, name: '', currency: repo.currency, theme: 'light' });
    this.token.set('local');
  }

  /** Vuelve a leer la moneda tras cambiarla o importar una copia. */
  async reloadUser(): Promise<void> {
    const repo = await this.store.ready;
    this.user.update((u) => (u ? { ...u, currency: repo.currency } : u));
  }

  login(_email: string, _password: string): Observable<never> {
    return throwError(() => new Error('No hay inicio de sesión en la versión local'));
  }
  register(_name: string, _email: string, _password: string): Observable<never> {
    return throwError(() => new Error('No hay registro en la versión local'));
  }
  refresh(): Observable<string> {
    return of('local');
  }
  logout(): void {
    /* no hay sesión que cerrar */
  }
}
