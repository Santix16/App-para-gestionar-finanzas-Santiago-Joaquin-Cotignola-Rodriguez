import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { API_URL } from './api.config';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly isDark = signal(this.initial());

  constructor() {
    effect(() => {
      const dark = this.isDark();
      document.documentElement.classList.toggle('dark', dark);
      try {
        localStorage.setItem('theme', dark ? 'dark' : 'light');
      } catch {
        /* almacenamiento no disponible */
      }
    });
  }

  toggle() {
    this.isDark.update((v) => !v);
    if (this.auth.isLoggedIn()) {
      this.http
        .patch(`${API_URL}/auth/theme`, { theme: this.isDark() ? 'dark' : 'light' })
        .subscribe({ error: () => undefined });
    }
  }

  private initial(): boolean {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
    } catch {
      /* ignorar */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
