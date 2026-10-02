/** Usuarios y sesiones en D1 (SQLite de Cloudflare). */

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
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

export function sessionUser(db: Database, tokenHash: string, now: string): Promise<User | null> {
  return db
    .prepare(
      `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
    )
    .bind(tokenHash, now)
    .first<User>();
}

export async function deleteSession(db: Database, tokenHash: string): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(tokenHash).run();
}

/** Borra la cuenta y todas sus sesiones. */
export async function deleteUser(db: Database, userId: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(userId),
    db.prepare(`DELETE FROM users WHERE id = ?1`).bind(userId),
  ]);
}
