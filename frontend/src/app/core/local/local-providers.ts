import { Provider } from '@angular/core';
import { ApiService } from '../api.service';
import { AuthService } from '../auth.service';
import { ThemeService } from '../theme.service';
import { LocalApiService } from './local-api.service';
import { LocalAuthService } from './local-auth.service';
import { LocalThemeService } from './local-theme.service';

/**
 * Proveedores que cambian la API remota por los datos locales.
 */
export const LOCAL_PROVIDERS: Provider[] = [
  { provide: ApiService, useExisting: LocalApiService },
  { provide: AuthService, useExisting: LocalAuthService },
  { provide: ThemeService, useExisting: LocalThemeService },
];

// Comprobación en compilación: la versión local debe ofrecer exactamente lo mismo que la remota.
type PublicOf<T> = { [K in keyof T]: T[K] };
export type LocalApiMatches = LocalApiService extends PublicOf<ApiService> ? true : never;
export type LocalAuthMatches = LocalAuthService extends PublicOf<AuthService> ? true : never;
export type LocalThemeMatches = LocalThemeService extends PublicOf<ThemeService> ? true : never;
export const LOCAL_COMPAT: [LocalApiMatches, LocalAuthMatches, LocalThemeMatches] = [true, true, true];
