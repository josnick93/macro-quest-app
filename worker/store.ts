/** Usuarios, sesiones y copia de los datos de cada usuario en D1 (SQLite de Cloudflare). */
import type { Change } from "../src/lib/syncApi";

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
/** Lo mínimo de la API de D1 que se usa aquí. */
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
}

export interface User {
  /** Identificador estable de la cuenta de Google (`sub`). */
  id: string;
  email: string;
  name: string | null;
}

/** Usuario de una sesión. `createdAt` identifica su copia en el servidor: cambia si borra la cuenta y vuelve. */
export interface Account extends User {
  createdAt: string;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL
  )`,
  // De la sesión solo se guarda el hash: quien lea la base no puede suplantar a nadie.
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  // Copia de los datos de cada usuario: un registro por (almacén, clave), con borrados incluidos.
  // `seq` crece con cada cambio del usuario: cada dispositivo pide "lo que hay después de mi último seq".
  `CREATE TABLE IF NOT EXISTS records (
    user_id TEXT NOT NULL,
    store TEXT NOT NULL,
    key TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    data TEXT,
    seq INTEGER NOT NULL,
    PRIMARY KEY (user_id, store, key)
  )`,
  `CREATE INDEX IF NOT EXISTS records_seq ON records (user_id, seq)`,
];

const ready = new WeakMap<Database, Promise<unknown>>();

/** Crea las tablas si faltan (una vez por instancia del worker). */
export function ensureSchema(db: Database): Promise<unknown> {
  let p = ready.get(db);
  if (!p) {
    p = db.batch(SCHEMA.map((sql) => db.prepare(sql)));
    ready.set(db, p);
    p.catch(() => ready.delete(db));
  }
  return p;
}

export async function upsertUser(db: Database, user: User, now: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, email, name, created_at, last_login_at) VALUES (?1, ?2, ?3, ?4, ?4)
       ON CONFLICT (id) DO UPDATE SET email = excluded.email, name = excluded.name, last_login_at = excluded.last_login_at`,
    )
    .bind(user.id, user.email, user.name, now)
    .run();
}

export async function createSession(db: Database, userId: string, tokenHash: string, now: string, expiresAt: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE expires_at < ?1`).bind(now),
    db.prepare(`INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)`).bind(tokenHash, userId, now, expiresAt),
  ]);
}

export function sessionUser(db: Database, tokenHash: string, now: string): Promise<Account | null> {
  return db
    .prepare(
      `SELECT u.id, u.email, u.name, u.created_at AS createdAt FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
    )
    .bind(tokenHash, now)
    .first<Account>();
}

export async function deleteSession(db: Database, tokenHash: string): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(tokenHash).run();
}

/** Borra la cuenta, todas sus sesiones y la copia de sus datos. */
export async function deleteUser(db: Database, userId: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM records WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM users WHERE id = ?1`).bind(userId),
  ]);
}

/**
 * Guarda los cambios de un dispositivo. Solo entra el que es más reciente que lo guardado (gana el último cambio).
 * Va todo en una sentencia: el plan gratuito de D1 limita las consultas por petición.
 */
export async function applyChanges(db: Database, userId: string, changes: Change[]): Promise<void> {
  if (changes.length === 0) return;
  await db
    .prepare(
      `INSERT INTO records (user_id, store, key, updated_at, deleted, data, seq)
       SELECT ?1, json_extract(j.value, '$.store'), json_extract(j.value, '$.key'), json_extract(j.value, '$.updatedAt'),
              json_extract(j.value, '$.deleted'), json_extract(j.value, '$.data'),
              (SELECT COALESCE(MAX(seq), 0) FROM records WHERE user_id = ?1) + 1 + j.key
       FROM json_each(?2) AS j WHERE true
       ON CONFLICT (user_id, store, key) DO UPDATE
         SET updated_at = excluded.updated_at, deleted = excluded.deleted, data = excluded.data, seq = excluded.seq
         WHERE excluded.updated_at > records.updated_at`,
    )
    .bind(userId, JSON.stringify(changes.map((c) => ({ ...c, deleted: c.deleted ? 1 : 0 }))))
    .run();
}

export interface StoredChange extends Change {
  seq: number;
}

/** Cambios del usuario posteriores a `cursor`, en orden. */
export async function changesSince(db: Database, userId: string, cursor: number, limit: number): Promise<StoredChange[]> {
  const { results } = await db
    .prepare(`SELECT store, key, updated_at AS updatedAt, deleted, data, seq FROM records WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3`)
    .bind(userId, cursor, limit)
    .all<Omit<StoredChange, "deleted"> & { deleted: number }>();
  return results.map((r) => ({ ...r, deleted: r.deleted === 1 }));
}
