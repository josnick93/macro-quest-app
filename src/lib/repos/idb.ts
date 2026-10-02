import { fromLegacy, LEGACY_PREFIX, normalizeProfile, normalizeSnapshot, SCHEMA_VERSION, type Snapshot } from "./migrations";

/** Envoltorio mínimo de IndexedDB (sin dependencias). */

export const DB_NAME = "macro-quest";
const DB_VERSION = 4;

export type StoreName = "diary" | "notes" | "foods" | "recipes" | "savedMeals" | "weights" | "kv" | "tombstones" | "outbox";
export const DATA_STORES: StoreName[] = ["diary", "notes", "foods", "recipes", "savedMeals", "weights", "kv", "tombstones", "outbox"];

/** Borrados registrados para la sincronización (gana el último cambio). */
export interface Tombstone {
  key: string;
  deletedAt: string;
}

/** Cambio local pendiente de subir a la nube. `mark` cambia si el registro se vuelve a tocar mientras se sube. */
export interface OutboxItem {
  /** "almacén:clave", igual que en `tombstones`. */
  key: string;
  mark: string;
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
  put("savedMeals", s.savedMeals);
  put("weights", s.weights);
  const kv = tx.objectStore("kv");
  kv.put(s.profile, "profile");
  kv.put(s.game, "game");
  kv.put(s.settings, "settings");
  kv.put(s.favorites, "favorites");
  kv.put(SCHEMA_VERSION, "schema");
}

/** Lee todo lo guardado en la v1 dentro de la transacción de actualización y llama a `done` con los datos crudos. */
function readRawV1(tx: IDBTransaction, done: (raw: Record<string, unknown>) => void) {
  const raw: Record<string, unknown> = {};
  const jobs: [string, IDBRequest][] = [
    ...(["diary", "notes", "foods", "recipes", "weights"] as const).map((s) => [s, tx.objectStore(s).getAll()] as [string, IDBRequest]),
    ...["profile", "game", "settings", "recents", "favorites"].map((k) => [k, tx.objectStore("kv").get(k)] as [string, IDBRequest]),
  ];
  let pending = jobs.length;
  for (const [key, r] of jobs) {
    r.onsuccess = () => {
      raw[key] = r.result;
      if (--pending === 0) done(raw);
    };
  }
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
        db.createObjectStore("foods", { keyPath: "id" }).createIndex("barcode", "barcode");
        db.createObjectStore("recipes", { keyPath: "id" });
        db.createObjectStore("savedMeals", { keyPath: "id" });
        db.createObjectStore("weights", { keyPath: "date" });
        db.createObjectStore("kv");
        db.createObjectStore("tombstones", { keyPath: "key" });
        db.createObjectStore("outbox", { keyPath: "key" });
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
      if (ev.oldVersion === 1) {
        // v1 → v2: índice por código de barras, comidas guardadas y alimentos unificados.
        // Todo ocurre en la misma transacción: si algo falla, la base se queda en v1 intacta.
        tx.objectStore("foods").createIndex("barcode", "barcode");
        db.createObjectStore("savedMeals", { keyPath: "id" });
        readRawV1(tx, (raw) => {
          const snapshot = normalizeSnapshot(raw);
          for (const s of ["diary", "notes", "foods", "recipes", "weights"] as const) tx.objectStore(s).clear();
          tx.objectStore("kv").delete("recents");
          writeSnapshot(tx, snapshot);
        });
      }
      if (ev.oldVersion === 2) {
        // v2 → v3: no cambian los stores; el perfil pasa de % de ajuste a kg/semana.
        const kv = tx.objectStore("kv");
        const r = kv.get("profile");
        r.onsuccess = () => {
          if (r.result) kv.put(normalizeProfile(r.result), "profile");
          kv.put(SCHEMA_VERSION, "schema");
        };
      }
      // v3 → v4: cola de cambios pendientes de subir. Los datos no cambian de forma (el esquema sigue en 3).
      if (ev.oldVersion >= 1 && ev.oldVersion < 4) db.createObjectStore("outbox", { keyPath: "key" });
      // Futuras versiones: if (ev.oldVersion === 4) { ... }
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

let dirtyListener: (() => void) | null = null;
let marks = 0;

/** Avisa cada vez que hay un cambio local pendiente de subir. */
export function onDirty(listener: (() => void) | null) {
  dirtyListener = listener;
}

/** Apunta un registro como pendiente de subir. La transacción debe incluir `outbox`. */
export function markDirty(tx: IDBTransaction, store: StoreName, id: string) {
  tx.objectStore("outbox").put({ key: `${store}:${id}`, mark: `${Date.now()}-${++marks}` } satisfies OutboxItem);
  dirtyListener?.();
}

/** Registra un borrado. La transacción debe incluir `tombstones` y `outbox`. */
export function tombstone(tx: IDBTransaction, store: StoreName, id: string, now: string) {
  tx.objectStore("tombstones").put({ key: `${store}:${id}`, deletedAt: now } satisfies Tombstone);
  markDirty(tx, store, id);
}

/** Registra que algo se ha guardado (deja de estar borrado). La transacción debe incluir `tombstones` y `outbox`. */
export function untombstone(tx: IDBTransaction, store: StoreName, id: string) {
  tx.objectStore("tombstones").delete(`${store}:${id}`);
  markDirty(tx, store, id);
}

/** Marca de tiempo de una clave de `kv` (perfil, ajustes…), que no la lleva dentro. */
export const kvStampKey = (key: string) => `stamp:${key}`;

/** Guarda un dato de usuario en `kv` con su marca de tiempo. La transacción debe incluir `kv` y `outbox`. */
export function putKv(tx: IDBTransaction, key: string, value: unknown, now: string) {
  const kv = tx.objectStore("kv");
  kv.put(value, key);
  kv.put(now, kvStampKey(key));
  markDirty(tx, "kv", key);
}

/** Pide al navegador que no borre los datos por falta de espacio (iOS/Safari los purga si no). */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}
