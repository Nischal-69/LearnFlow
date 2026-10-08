/**
 * Centralized key-value storage adapter.
 *
 * This is the ONLY module allowed to touch `window.localStorage` directly.
 * Everything else (store, hooks, components, reminders) must go through
 * `loadJSON` / `saveJSON` / `removeKey` so a future backend (Supabase /
 * PostgreSQL) can replace this file without touching callers.
 *
 * Migration path:
 *  - v1 (local): `LocalStorageAdapter` below (default export `storage`).
 *  - v2 (remote): implement the same `KeyValueStorage` interface with a
 *    Supabase/Postgres client (e.g. `SupabaseStorageAdapter`) and swap the
 *    singleton. For real tables, replace per-entity repositories in
 *    `src/data/service.ts` with async Supabase queries keeping the same
 *    function names/signatures.
 */

export const KEYS = {
  /** Main database document (all collections). Refresh-safe: never cleared on load. */
  STATE: 'learnflow-state-v1',
  /** Reminder prefs + dismissals kept under separate keys for v1 compat. */
  REMINDER_PREFS: 'learnflow-reminder-prefs-v1',
  REMINDER_DISMISSED: 'learnflow-reminder-dismissed-v1',
} as const;

export type StorageKey = (typeof KEYS)[keyof typeof KEYS] | string;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class LocalStorageAdapter implements KeyValueStorage {
  getItem(key: string): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  setItem(key: string, value: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(key, value);
    } catch {
      // storage full / unavailable (private mode) — ignore for v1, data stays in memory
    }
  }
  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

class MemoryAdapter implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function pickAdapter(): KeyValueStorage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return new LocalStorageAdapter();
  } catch {
    // fall through to memory
  }
  return new MemoryAdapter();
}

/** Singleton storage backend. Swap this for a remote adapter to migrate. */
export const storage: KeyValueStorage = pickAdapter();

/** Read + JSON-parse a key. Returns `fallback` on missing/corrupt data (never throws). */
export function loadJSON<T>(key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** JSON-stringify + persist a key (never throws). */
export function saveJSON(key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore for v1
  }
}

export function removeKey(key: string): void {
  storage.removeItem(key);
}
