import { LocalData, LocalRepo, parseLocalData, seedData } from './local-repo';

/** Almacén clave-valor asíncrono donde se guarda el JSON con todos los datos. */
export interface KeyValueStorage {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
}

const DB_NAME = 'finanzas';
const STORE = 'kv';
const KEY = 'data';
const LS_KEY = 'finanzas-data';
const LS_CORRUPT_KEY = 'finanzas-data-corrupta';

/** IndexedDB: más espacio y más fiable que localStorage dentro del WebView. */
export class IndexedDbStorage implements KeyValueStorage {
  private dbPromise?: Promise<IDBDatabase>;

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('No se pudo abrir IndexedDB'));
    });
    return this.dbPromise;
  }

  async get(): Promise<string | null> {
    const db = await this.db();
    return new Promise<string | null>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => reject(req.error ?? new Error('Error al leer'));
    });
  }

  async set(value: string): Promise<void> {
    const db = await this.db();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Error al guardar'));
      tx.onabort = () => reject(tx.error ?? new Error('Escritura cancelada'));
    });
  }
}

export class LocalStorageStorage implements KeyValueStorage {
  get(): Promise<string | null> {
    try {
      return Promise.resolve(localStorage.getItem(LS_KEY));
    } catch (err) {
      return Promise.reject(err);
    }
  }
  set(value: string): Promise<void> {
    try {
      localStorage.setItem(LS_KEY, value);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

export class MemoryStorage implements KeyValueStorage {
  constructor(private value: string | null = null) {}
  get(): Promise<string | null> {
    return Promise.resolve(this.value);
  }
  set(value: string): Promise<void> {
    this.value = value;
    return Promise.resolve();
  }
}

/** Usa el primero y, si falla (modo privado, almacenamiento bloqueado...), el segundo. */
export class ResilientStorage implements KeyValueStorage {
  constructor(
    private readonly primary: KeyValueStorage,
    private readonly fallback: KeyValueStorage,
  ) {}

  async get(): Promise<string | null> {
    try {
      const v = await this.primary.get();
      if (v !== null) return v;
    } catch {
    }
    return this.fallback.get().catch(() => null);
  }

  async set(value: string): Promise<void> {
    try {
      await this.primary.set(value);
    } catch {
      await this.fallback.set(value);
    }
  }
}

export function createDefaultStorage(): KeyValueStorage {
  const hasIdb = typeof indexedDB !== 'undefined';
  return hasIdb
    ? new ResilientStorage(new IndexedDbStorage(), new LocalStorageStorage())
    : new LocalStorageStorage();
}

/**
 * Abre los datos guardados (o crea los iniciales) y ofrece el repositorio.
 * Las escrituras se encolan para que nunca se pisen entre sí.
 */
export class LocalStore {
  private opened?: Promise<LocalRepo>;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly storage: KeyValueStorage) {}

  /** Repositorio listo para usar; los datos se abren la primera vez que se pide. */
  get ready(): Promise<LocalRepo> {
    this.opened ??= this.open();
    return this.opened;
  }

  private async open(): Promise<LocalRepo> {
    let raw: string | null = null;
    try {
      raw = await this.storage.get();
    } catch {
      raw = null;
    }

    let data: LocalData | null = null;
    if (raw) {
      try {
        data = parseLocalData(JSON.parse(raw));
      } catch {
        try {
          localStorage.setItem(LS_CORRUPT_KEY, raw);
        } catch {
        }
      }
    }

    const repo = new LocalRepo(data ?? seedData(), (d) => this.write(d));
    if (!data) await repo.save();

    // Pide al sistema que no borre los datos si falta espacio
    Promise.resolve()
      .then(() => navigator.storage?.persist?.())
      .catch(() => undefined);
    return repo;
  }

  private write(data: LocalData): Promise<void> {
    const job = this.chain.then(() => this.storage.set(JSON.stringify(data)));
    this.chain = job.catch(() => undefined);
    return job;
  }
}
