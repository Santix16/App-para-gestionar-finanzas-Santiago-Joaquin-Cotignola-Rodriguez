import { InjectionToken } from '@angular/core';
import { LocalStore, createDefaultStorage } from './local-store';

/** Almacén local único de la aplicación. */
export const LOCAL_STORE = new InjectionToken<LocalStore>('LOCAL_STORE', {
  providedIn: 'root',
  factory: () => new LocalStore(createDefaultStorage()),
});
