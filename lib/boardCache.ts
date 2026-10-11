// Device-local snapshot of the last server-confirmed board (real app only).
//
// Perf (mobile): the app used to show an empty shell until GET /api/state came
// back (auth + ~15 DB queries + a possible serverless cold start). With this
// cache the last known board renders instantly; the server load then merges on
// top with the same newer-wins rules as the on-focus resync.
//
// The snapshot has the exact shape of the GET /api/state response, and it is
// only ever written while nothing is pending — so it can serve as the diff-save
// baseline just like a fresh server load.
//
// IndexedDB (not localStorage): notes bodies can exceed the ~5 MB quota, and
// IDB doesn't block the main thread on large writes. Every call is best-effort:
// a private window / blocked storage just means no cache.

const DB_NAME = "cnsl";
const STORE = "board";
const KEY = "snapshot";
const VERSION = 1; // bump to invalidate snapshots after a shape change

export type BoardSnapshot = Record<string, unknown> & { boardId?: string; ownerId?: string };

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => {
            db.close();
            resolve(req ? ((req.result as T) ?? null) : null);
          };
          tx.onerror = tx.onabort = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      })
  );
}

export async function readBoardCache(): Promise<BoardSnapshot | null> {
  const rec = await run<{ v: number; data: BoardSnapshot }>("readonly", (s) => s.get(KEY));
  return rec && rec.v === VERSION && rec.data && typeof rec.data === "object" ? rec.data : null;
}

export async function writeBoardCache(data: BoardSnapshot): Promise<void> {
  await run("readwrite", (s) => {
    s.put({ v: VERSION, savedAt: new Date().toISOString(), data }, KEY);
  });
}

// Sign-out / account deletion: don't leave the board readable on the device.
export async function clearBoardCache(): Promise<void> {
  await run("readwrite", (s) => {
    s.delete(KEY);
  });
}
