/** Protocolo de sincronización (POST /api/sync), compartido entre la app y el worker. */

export const SYNC_STORES = ["diary", "notes", "foods", "recipes", "savedMeals", "weights", "kv"] as const;
export type SyncStore = (typeof SYNC_STORES)[number];

/** Claves de `kv` que son datos del usuario (el resto son internas del dispositivo). */
export const SYNC_KV_KEYS = ["profile", "settings", "favorites", "game"] as const;
export type SyncKvKey = (typeof SYNC_KV_KEYS)[number];

/** Un registro que ha cambiado. Gana siempre el `updatedAt` más reciente; un borrado es un cambio más. */
export interface Change {
  store: SyncStore;
  key: string;
  /** ISO en UTC con milisegundos: se compara como texto. */
  updatedAt: string;
  deleted: boolean;
  /** El registro en JSON; null si está borrado. */
  data: string | null;
}

export interface SyncRequest {
  /** Identifica la copia del servidor que conoce este dispositivo; null la primera vez. */
  epoch: string | null;
  /** Hasta dónde ha recibido ya este dispositivo. */
  cursor: number;
  changes: Change[];
}

export interface SyncResponse {
  epoch: string;
  cursor: number;
  changes: Change[];
  /** Quedan cambios por bajar: hay que volver a pedir. */
  more: boolean;
}

/** Límites por petición (en caracteres), holgados para D1: 2 MB por valor. */
export const MAX_CHANGES = 200;
export const MAX_BODY_CHARS = 600_000;
export const MAX_RECORD_CHARS = 200_000;
/** Tamaño de los datos de un lote de subida: deja margen porque el JSON anidado crece al escaparse. */
export const PUSH_CHARS = 250_000;
export const MAX_KEY_CHARS = 200;

/** Fecha de los datos que nunca llevaron marca de tiempo: pierden contra cualquier otra versión. */
export const EPOCH = "1970-01-01T00:00:00.000Z";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const isStamp = (v: unknown): v is string => typeof v === "string" && ISO.test(v);

/** Marca de tiempo comparable como texto, venga como venga guardada. */
export function stamp(v: unknown): string {
  if (isStamp(v)) return v;
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : EPOCH;
}

const isStore = (v: unknown): v is SyncStore => SYNC_STORES.some((s) => s === v);

/** Valida un cambio recibido; null si no es aceptable. */
export function parseChange(v: unknown): Change | null {
  if (typeof v !== "object" || v === null) return null;
  const c = v as Record<string, unknown>;
  if (!isStore(c.store) || typeof c.key !== "string" || !c.key || c.key.length > MAX_KEY_CHARS || !isStamp(c.updatedAt)) return null;
  if (c.store === "kv" && !SYNC_KV_KEYS.some((k) => k === c.key)) return null;
  if (c.deleted === true) return { store: c.store, key: c.key, updatedAt: c.updatedAt, deleted: true, data: null };
  if (c.deleted !== false || typeof c.data !== "string" || !c.data || c.data.length > MAX_RECORD_CHARS) return null;
  return { store: c.store, key: c.key, updatedAt: c.updatedAt, deleted: false, data: c.data };
}
