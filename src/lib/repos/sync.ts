import type { SessionUser } from "../auth";
import { mergeGame } from "../xp";
import {
  MAX_CHANGES,
  MAX_RECORD_CHARS,
  parseChange,
  PUSH_CHARS,
  stamp,
  SYNC_KV_KEYS,
  type Change,
  type SyncKvKey,
  type SyncRequest,
  type SyncResponse,
} from "../syncApi";
import { DATA_STORES, kvStampKey, putKv, req, run, type OutboxItem, type Tombstone } from "./idb";
import { normalizeFavorites, normalizeGame, normalizeProfile, normalizeRecord, normalizeSettings, SCHEMA_VERSION, type RecordStore } from "./migrations";
import type { SyncOwner, SyncRepository, SyncResult } from "./types";

/**
 * Sincronización con la nube (POST /api/sync).
 * Cada escritura local deja su clave en `outbox`; aquí se sube lo pendiente y se aplica lo que llega.
 * Ante conflicto gana el cambio más reciente (`updatedAt`); los borrados viajan como `tombstones`.
 */

export const SYNC_META_KEY = "sync";

/** Estado de la sincronización en este dispositivo (en `kv`, no se exporta). */
export interface SyncMeta {
  /** Cuenta dueña de los datos de este dispositivo. */
  userId: string;
  email: string;
  /** Copia del servidor con la que se ha sincronizado; null si aún no se ha completado ninguna. */
  epoch: string | null;
  cursor: number;
  /** Hay que subirlo todo (primera vez, tras importar o si el servidor ha perdido la copia). */
  full: boolean;
}

export type SyncErrorCode = "network" | "unauthorized" | "mismatch" | "disabled" | "server";

export class SyncError extends Error {
  constructor(
    readonly code: SyncErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const RECORD_STORES: RecordStore[] = ["diary", "notes", "foods", "recipes", "savedMeals", "weights"];
const isRecordStore = (s: string): s is RecordStore => RECORD_STORES.some((r) => r === s);
const isKvKey = (k: string): k is SyncKvKey => SYNC_KV_KEYS.some((s) => s === k);
const MAX_ROUNDS = 200;

const nowISO = () => new Date().toISOString();

/** "almacén:clave" → sus dos partes (la clave puede llevar ":"). */
function splitKey(key: string): [string, string] {
  const i = key.indexOf(":");
  return [key.slice(0, i), key.slice(i + 1)];
}

async function loadMeta(user: SessionUser): Promise<SyncMeta> {
  return run(["kv"], "readwrite", async (tx) => {
    const kv = tx.objectStore("kv");
    const meta = (await req(kv.get(SYNC_META_KEY))) as SyncMeta | undefined;
    if (meta && meta.userId !== user.id) throw new SyncError("mismatch", "Los datos de este dispositivo son de otra cuenta");
    if (meta && meta.email === user.email) return meta;
    // Primera vez con cuenta: los datos que ya hubiera aquí pasan a ser suyos y se suben.
    const next: SyncMeta = meta ? { ...meta, email: user.email } : { userId: user.id, email: user.email, epoch: null, cursor: 0, full: true };
    kv.put(next, SYNC_META_KEY);
    return next;
  });
}

const saveMeta = (meta: SyncMeta) => run(["kv"], "readwrite", (tx) => void tx.objectStore("kv").put(meta, SYNC_META_KEY));

/** Pone en la cola todo lo que hay en el dispositivo. */
function enqueueAll(meta: SyncMeta): Promise<SyncMeta> {
  return run(DATA_STORES, "readwrite", async (tx) => {
    const outbox = tx.objectStore("outbox");
    const add = (key: string) => outbox.put({ key, mark: "full" } satisfies OutboxItem);
    for (const s of RECORD_STORES) for (const k of await req(tx.objectStore(s).getAllKeys())) add(`${s}:${String(k)}`);
    for (const k of await req(tx.objectStore("tombstones").getAllKeys())) add(String(k));
    const kv = tx.objectStore("kv");
    const now = nowISO();
    for (const k of SYNC_KV_KEYS) {
      if ((await req(kv.get(k))) === undefined) continue;
      // Lo que se guardó antes de existir la sincronización no tiene fecha: cuenta como de ahora.
      if ((await req(kv.get(kvStampKey(k)))) === undefined) kv.put(now, kvStampKey(k));
      add(`kv:${k}`);
    }
    const next: SyncMeta = { ...meta, full: false };
    kv.put(next, SYNC_META_KEY);
    return next;
  });
}

interface Batch {
  /** Elementos de la cola que cubre este lote (los enviados y los que no tenían nada que enviar). */
  items: OutboxItem[];
  changes: Change[];
}

/** Siguiente lote de cambios pendientes, con el estado actual de cada registro. */
function nextBatch(): Promise<Batch> {
  return run(DATA_STORES, "readonly", async (tx) => {
    const queued = (await req(tx.objectStore("outbox").getAll(null, MAX_CHANGES))) as OutboxItem[];
    const batch: Batch = { items: [], changes: [] };
    let chars = 0;
    for (const item of queued) {
      const [store, key] = splitKey(item.key);
      let change: Change | null = null;
      if (store === "kv" && isKvKey(key)) {
        const value: unknown = await req(tx.objectStore("kv").get(key));
        if (value !== undefined) {
          const at = stamp(await req(tx.objectStore("kv").get(kvStampKey(key))));
          change = { store: "kv", key, updatedAt: at, deleted: false, data: JSON.stringify(value) };
        }
      } else if (isRecordStore(store)) {
        const record = (await req(tx.objectStore(store).get(key))) as { updatedAt?: string } | undefined;
        if (record) {
          change = { store, key, updatedAt: stamp(record.updatedAt), deleted: false, data: JSON.stringify(record) };
        } else {
          const tomb = (await req(tx.objectStore("tombstones").get(item.key))) as Tombstone | undefined;
          if (tomb) change = { store, key, updatedAt: stamp(tomb.deletedAt), deleted: true, data: null };
        }
      }
      if (change?.data && change.data.length > MAX_RECORD_CHARS) {
        console.warn(`Sincronización: ${item.key} es demasiado grande y no se sube`);
        change = null;
      }
      const size = change?.data?.length ?? 0;
      if (batch.changes.length > 0 && chars + size > PUSH_CHARS) break;
      batch.items.push(item);
      if (change) {
        batch.changes.push(change);
        chars += size;
      }
    }
    return batch;
  });
}

type Reply = { reset: true } | { reset: false; data: SyncResponse };

async function post(body: SyncRequest): Promise<Reply> {
  let res: Response;
  try {
    res = await fetch("/api/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SyncError("network", "Sin conexión");
  }
  if (res.status === 409) return { reset: true };
  if (res.status === 401) throw new SyncError("unauthorized", "La sesión ha caducado");
  if (res.status === 503) throw new SyncError("disabled", "La sincronización no está disponible");
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) throw new SyncError("server", `El servidor respondió ${res.status}`);
  const raw = (await res.json()) as Partial<Record<keyof SyncResponse, unknown>>;
  if (typeof raw.epoch !== "string" || typeof raw.cursor !== "number" || !Array.isArray(raw.changes)) {
    throw new SyncError("server", "Respuesta del servidor no válida");
  }
  const changes = raw.changes.flatMap((c) => {
    const change = parseChange(c);
    return change ? [change] : [];
  });
  return { reset: false, data: { epoch: raw.epoch, cursor: raw.cursor, changes, more: raw.more === true } };
}

const sameGame = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Aplica un cambio llegado del servidor si es más reciente que lo local. Devuelve si ha cambiado algo aquí. */
async function applyIncoming(tx: IDBTransaction, c: Change, now: string): Promise<boolean> {
  const outboxKey = `${c.store}:${c.key}`;
  const outbox = tx.objectStore("outbox");
  let raw: unknown = null;
  if (!c.deleted) {
    try {
      raw = JSON.parse(c.data ?? "null");
    } catch {
      return false;
    }
  }

  if (c.store === "kv") {
    if (c.deleted || !isKvKey(c.key)) return false;
    const kv = tx.objectStore("kv");
    const local: unknown = await req(kv.get(c.key));
    const localStamp = local === undefined ? "" : stamp(await req(kv.get(kvStampKey(c.key))));
    const accept = (value: unknown) => {
      kv.put(value, c.key);
      kv.put(c.updatedAt, kvStampKey(c.key));
      outbox.delete(outboxKey);
    };

    if (c.key === "game") {
      // El juego no se pisa: se une, para que la XP ganada en cada dispositivo cuente.
      if (c.updatedAt === localStamp) return false;
      const remote = normalizeGame(raw);
      const canonRemote = mergeGame(remote, remote);
      if (local === undefined) {
        accept(canonRemote);
        return true;
      }
      const mine = normalizeGame(local);
      const merged = mergeGame(mine, remote);
      if (sameGame(merged, canonRemote)) accept(merged);
      else putKv(tx, "game", merged, now); // lleva algo que el servidor no tiene: se vuelve a subir
      return !sameGame(merged, mergeGame(mine, mine));
    }

    if (c.updatedAt <= localStamp) return false;
    accept(c.key === "profile" ? normalizeProfile(raw) : c.key === "settings" ? normalizeSettings(raw) : normalizeFavorites(raw));
    return true;
  }

  const os = tx.objectStore(c.store);
  const tombstones = tx.objectStore("tombstones");
  const local = (await req(os.get(c.key))) as { updatedAt?: string } | undefined;
  const tomb = (await req(tombstones.get(outboxKey))) as Tombstone | undefined;
  const saved = local ? stamp(local.updatedAt) : "";
  const removed = tomb ? stamp(tomb.deletedAt) : "";
  if (c.updatedAt <= (saved > removed ? saved : removed)) return false;

  if (c.deleted) {
    os.delete(c.key);
    tombstones.put({ key: outboxKey, deletedAt: c.updatedAt } satisfies Tombstone);
  } else {
    const record = normalizeRecord(c.store, raw, c.updatedAt);
    if (!record || record.key !== c.key) return false;
    os.put({ ...record.value, updatedAt: c.updatedAt });
    tombstones.delete(outboxKey);
  }
  outbox.delete(outboxKey);
  return true;
}

/** Guarda en una sola transacción lo recibido, lo ya subido y el nuevo punto de sincronización. */
function commit(meta: SyncMeta, batch: Batch, res: SyncResponse): Promise<{ meta: SyncMeta; pulled: number }> {
  return run(DATA_STORES, "readwrite", async (tx) => {
    const outbox = tx.objectStore("outbox");
    // Lo subido sale de la cola, salvo que se haya vuelto a tocar mientras tanto.
    for (const item of batch.items) {
      const current = (await req(outbox.get(item.key))) as OutboxItem | undefined;
      if (current && current.mark === item.mark) outbox.delete(item.key);
    }
    const now = nowISO();
    let pulled = 0;
    for (const change of res.changes) if (await applyIncoming(tx, change, now)) pulled++;
    const next: SyncMeta = { ...meta, epoch: res.epoch, cursor: res.cursor };
    tx.objectStore("kv").put(next, SYNC_META_KEY);
    return { meta: next, pulled };
  });
}

const pendingCount = () => run(["outbox"], "readonly", (tx) => req(tx.objectStore("outbox").count()));

async function sync(user: SessionUser): Promise<SyncResult> {
  let meta = await loadMeta(user);
  let pushed = 0;
  let pulled = 0;
  let resets = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (meta.full) meta = await enqueueAll(meta);
    const batch = await nextBatch();
    const reply = await post({ epoch: meta.epoch, cursor: meta.cursor, changes: batch.changes });
    if (reply.reset) {
      // El servidor ya no tiene la copia que conocíamos: se vuelve a subir todo desde cero.
      if (++resets > 1) throw new SyncError("server", "El servidor no acepta la sincronización");
      meta = { ...meta, epoch: null, cursor: 0, full: true };
      await saveMeta(meta);
      continue;
    }
    const done = await commit(meta, batch, reply.data);
    meta = done.meta;
    pushed += batch.changes.length;
    pulled += done.pulled;
    if (!reply.data.more && (await pendingCount()) === 0) break;
    // Nada que subir ni que bajar en esta vuelta: lo pendiente no se puede enviar ahora.
    if (!reply.data.more && batch.items.length === 0) break;
  }
  return { pushed, pulled };
}

export function createSyncRepository(): SyncRepository {
  let active: Promise<SyncResult> | null = null;
  return {
    async owner(): Promise<SyncOwner | null> {
      const meta = await run(["kv"], "readonly", (tx) => req(tx.objectStore("kv").get(SYNC_META_KEY) as IDBRequest<SyncMeta | undefined>));
      return meta ? { userId: meta.userId, email: meta.email, synced: meta.epoch !== null } : null;
    },
    pending: pendingCount,
    run(user) {
      active ??= sync(user).finally(() => (active = null));
      return active;
    },
    forget() {
      return run(["kv", "outbox"], "readwrite", (tx) => {
        tx.objectStore("kv").delete(SYNC_META_KEY);
        tx.objectStore("outbox").clear();
      });
    },
    wipe() {
      return run(DATA_STORES, "readwrite", (tx) => {
        for (const s of DATA_STORES) tx.objectStore(s).clear();
        tx.objectStore("kv").put(SCHEMA_VERSION, "schema");
      });
    },
  };
}
