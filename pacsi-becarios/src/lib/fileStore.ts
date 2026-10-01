/**
 * Archivos adjuntos (CVs, certificados) guardados en la computadora con IndexedDB.
 * Funciona igual en el programa de escritorio y en el navegador.
 */
const DB_NAME = 'pacsi-becarios';
const STORE = 'archivos';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const fileStore = {
  put: (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id)),
  get: (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id)),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)),
  clear: () => tx('readwrite', (s) => s.clear()),
};
