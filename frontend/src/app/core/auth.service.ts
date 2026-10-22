import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, finalize, firstValueFrom, map, shareReplay, tap } from 'rxjs';
import { API_URL } from './api.config';

export interface User {
  id: number;
  name: string;
  currency: string;
  theme: string;
}

interface SessionResponse {
  token: string;
  user: User;
}

const USER_KEY = 'user';
const SESSION_HINT_KEY = 'session';

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/**
 * Sesión con dos tokens:
 *  - access token (15 min): solo en memoria, nunca en localStorage.
 *  - refresh token (7 días): cookie httpOnly que el navegador envía sola
 *    y que JavaScript no puede leer (protege frente a XSS).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(null);
  readonly user = signal<User | null>(readUser());
  readonly isLoggedIn = computed(() => !!this.token());

  /** Renovación en curso, compartida para no lanzar varias a la vez. */
  private refresh$?: Observable<string>;

  constructor() {
    // Limpieza de versiones anteriores, que guardaban el token en localStorage
    try {
      localStorage.removeItem('token');
    } catch {
    }
  }

  /** Se ejecuta al arrancar la app: recupera la sesión si hay cookie de refresh. */
  async restoreSession(): Promise<void> {
    if (!this.hasSessionHint()) return;
    try {
      await firstValueFrom(this.refresh());
    } catch {
      this.clearLocal();
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<SessionResponse>(`${API_URL}/auth/login`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  register(name: string, email: string, password: string) {
    return this.http.post(`${API_URL}/auth/register`, { name, email, password });
  }

  /** Pide un access token nuevo usando la cookie de refresh. */
  refresh(): Observable<string> {
    if (!this.refresh$) {
      this.refresh$ = this.http.post<SessionResponse>(`${API_URL}/auth/refresh`, {}).pipe(
        tap((res) => this.setSession(res)),
        map((res) => res.token),
        finalize(() => (this.refresh$ = undefined)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refresh$;
  }

  logout() {
    // Pide al servidor que borre la cookie; si falla, igualmente cerramos en local
    this.http.post(`${API_URL}/auth/logout`, {}).subscribe({ error: () => undefined });
    this.clearLocal();
    void this.router.navigate(['/login']);
  }

  private setSession(res: SessionResponse) {
    this.token.set(res.token);
    this.user.set(res.user);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      localStorage.setItem(SESSION_HINT_KEY, '1');
    } catch {
    }
  }

  private clearLocal() {
    this.token.set(null);
    this.user.set(null);
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SESSION_HINT_KEY);
    } catch {
    }
  }

  private hasSessionHint(): boolean {
    try {
      return localStorage.getItem(SESSION_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }
}
