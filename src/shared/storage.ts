/** The parts of `Storage` we use; tests pass an in-memory version. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
  };
}

let fallback: KeyValueStore | null = null;

/** localStorage when available (it can throw in private browsing), else memory. */
export function deviceStore(): KeyValueStore {
  try {
    const store = globalThis.localStorage;
    const probe = '__sg_probe__';
    store.setItem(probe, probe);
    store.removeItem(probe);
    return store;
  } catch {
    fallback ??= memoryStore();
    return fallback;
  }
}

export function readJson<T>(store: KeyValueStore, key: string, fallbackValue: T): T {
  try {
    const raw = store.getItem(key);
    return raw === null ? fallbackValue : (JSON.parse(raw) as T);
  } catch {
    return fallbackValue;
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled: progress just isn't saved.
  }
}
