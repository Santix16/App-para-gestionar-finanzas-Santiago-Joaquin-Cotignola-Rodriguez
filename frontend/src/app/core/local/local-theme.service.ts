import { Injectable, effect, signal } from '@angular/core';

/** Tema claro/oscuro de la APK: se guarda solo en el dispositivo (sin llamadas a la API). */
@Injectable({ providedIn: 'root' })
export class LocalThemeService {
  readonly isDark = signal(this.initial());

  constructor() {
    effect(() => {
      const dark = this.isDark();
      document.documentElement.classList.toggle('dark', dark);
      try {
        localStorage.setItem('theme', dark ? 'dark' : 'light');
      } catch {
      }
    });
  }

  toggle() {
    this.isDark.update((v) => !v);
  }

  private initial(): boolean {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
    } catch {
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
