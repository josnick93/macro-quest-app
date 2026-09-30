import { fromLegacy, LEGACY_PREFIX, SCHEMA_VERSION, type Snapshot } from "./migrations";

/** Envoltorio mínimo de IndexedDB (sin dependencias). */

export const DB_NAME = "macro-quest";
const DB_VERSION = 1;

export type StoreName = "diary" | "notes" | "foods" | "recipes" | "weights" | "kv" | "tombstones";
export const DATA_STORES: StoreName[] = ["diary", "notes", "foods", "recipes", "weights", "kv", "tombstones"];

/** Borrados registrados para la futura sincronización (last-write-wins). */
export interface Tombstone {
  key: string;
  deletedAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Lee los datos de la versión antigua en localStorage, si existen. */
function readLegacy(): Snapshot | null {
  try {
    const ls = window.localStorage;
    let found = false;
    for (let i = 0; i < ls.length; i++) if (ls.key(i)?.startsWith(LEGACY_PREFIX)) found = true;
    if (!found) return null;
    return fromLegacy((key) => {
      const raw = ls.getItem(LEGACY_PREFIX + key);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    });
  } catch {
    return null;
  }
}

export function writeSnapshot(tx: IDBTransaction, s: Snapshot): void {
  const put = (store: StoreName, items: object[]) => {
    const os = tx.objectStore(store);
    for (const it of items) os.put(it);
  };
  put("diary", s.diary);
  put("notes", s.notes);
  put("foods", s.foods);
  put("recipes", s.recipes);
  put("weights", s.weights);
  const kv = tx.objectStore("kv");
  kv.put(s.profile, "profile");
  kv.put(s.game, "game");
  kv.put(s.settings, "settings");
  kv.put(s.recents, "recents");
  kv.put(s.favorites, "favorites");
  kv.put(SCHEMA_VERSION, "schema");
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Este navegador no permite guardar datos (IndexedDB)"));
    const open = indexedDB.open(DB_NAME, DB_VERSION);

    open.onupgradeneeded = (ev) => {
      const db = open.result;
      const tx = open.transaction!;
      if (ev.oldVersion < 1) {
        db.createObjectStore("diary", { keyPath: "id" }).createIndex("date", "date");
        db.createObjectStore("notes", { keyPath: "date" });
        db.createObjectStore("foods", { keyPath: "id" });
        db.createObjectStore("recipes", { keyPath: "id" });
        db.createObjectStore("weights", { keyPath: "date" });
        db.createObjectStore("kv");
        db.createObjectStore("tombstones", { keyPath: "key" });
        // Migración desde localStorage. Si falla, la transacción se aborta y localStorage queda intacto.
        // Las claves antiguas se conservan como copia de seguridad.
        const legacy = readLegacy();
        if (legacy) {
          writeSnapshot(tx, legacy);
          tx.objectStore("kv").put(new Date().toISOString(), "migratedFromLocalStorage");
        } else {
          tx.objectStore("kv").put(SCHEMA_VERSION, "schema");
        }
      }
      // Futuras versiones: if (ev.oldVersion < 2) { ... }
    };
    open.onsuccess = () => {
      const db = open.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    open.onerror = () => reject(open.error ?? new Error("No se pudo abrir la base de datos"));
    open.onblocked = () => reject(new Error("Cierra otras pestañas de la app y recarga"));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

export const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

/**
 * Ejecuta `body` dentro de una transacción y resuelve cuando se ha confirmado en disco.
 * Cualquier error (incluido almacenamiento lleno) rechaza la promesa: nunca se falla en silencio.
 */
export async function run<T>(
  stores: StoreName[],
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Error guardando datos"));
    tx.onabort = () => reject(tx.error ?? new Error("Operación cancelada"));
  });
  done.catch(() => {});
  let result: T;
  try {
    result = await body(tx);
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* ya abortada */
    }
    throw e;
  }
  await done;
  return result;
}

export function tombstone(tx: IDBTransaction, store: StoreName, id: string, now: string) {
  tx.objectStore("tombstones").put({ key: `${store}:${id}`, deletedAt: now } satisfies Tombstone);
}

export function untombstone(tx: IDBTransaction, store: StoreName, id: string) {
  tx.objectStore("tombstones").delete(`${store}:${id}`);
}

/** Pide al navegador que no borre los datos por falta de espacio (iOS/Safari los purga si no). */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}
