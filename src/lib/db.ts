// Minimal promise wrapper around IndexedDB. Stores opaque values only;
// everything sensitive is sealed with AES-GCM before it reaches this layer.
const DB_NAME = 'spendvault';
const STORE = 'kv';
let dbp: Promise<IDBDatabase> | null = null;

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const idbGet = <T>(key: string) => tx<T | undefined>('readonly', (s) => s.get(key));
export const idbSet = (key: string, value: unknown) => tx('readwrite', (s) => s.put(value, key)).then(() => undefined);
export const idbDel = (key: string) => tx('readwrite', (s) => s.delete(key)).then(() => undefined);
export const idbClear = () => tx('readwrite', (s) => s.clear()).then(() => undefined);

/** Ask the browser not to evict our storage under pressure. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* best effort */
  }
}
