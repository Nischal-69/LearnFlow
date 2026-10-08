import { useEffect, useState } from 'react';
import { loadJSON, saveJSON } from './data/storage';

/**
 * Persisted React state. Delegates all browser I/O to the centralized
 * storage adapter — this hook never touches `window.localStorage` directly.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => loadJSON<T>(key, initialValue));

  useEffect(() => {
    saveJSON(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
