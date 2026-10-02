/**
 * Sincronización de los datos del usuario (POST /api/sync).
 * El dispositivo sube sus cambios y recibe los que le faltan; ante conflicto gana el cambio más reciente.
 */
import { currentUser, enabled, type AuthEnv } from "./auth";
import { json } from "./http";
import { applyChanges, changesSince } from "./store";
import { MAX_BODY_CHARS, MAX_CHANGES, parseChange, type Change, type SyncResponse } from "../src/lib/syncApi";

const PULL_LIMIT = 500;
const PULL_CHARS = 800_000;
/** Un reloj adelantado no puede ganar para siempre: lo que venga del futuro se fecha ahora. */
const MAX_AHEAD_MS = 5 * 60_000;

interface Body {
  epoch: string | null;
  cursor: number;
  changes: Change[];
}

function parseBody(text: string): Body | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (b.epoch !== null && typeof b.epoch !== "string") return null;
  if (typeof b.cursor !== "number" || !Number.isSafeInteger(b.cursor) || b.cursor < 0) return null;
  if (!Array.isArray(b.changes) || b.changes.length > MAX_CHANGES) return null;
  const changes: Change[] = [];
  for (const item of b.changes) {
    const change = parseChange(item);
    if (!change) return null;
    changes.push(change);
  }
  return { epoch: b.epoch, cursor: b.cursor, changes };
}

const echoKey = (c: Change) => `${c.store}\n${c.key}\n${c.updatedAt}`;

export async function handleSync(request: Request, env: AuthEnv, now: () => number = () => Date.now()): Promise<Response> {
  if (!enabled(env)) return json({ error: "La sincronización no está configurada" }, 503);
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);
  // Solo se aceptan peticiones hechas desde la propia app.
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origen no permitido" }, 403);
  const nowMs = now();
  const session = await currentUser(request, env, nowMs);
  if (!session) return json({ error: "Sesión no válida" }, 401);

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return json({ error: "Demasiados datos en una petición" }, 413);
  const body = parseBody(text);
  if (!body) return json({ error: "Petición no válida" }, 400);

  // La copia que conocía el dispositivo ya no existe (cuenta borrada y creada de nuevo): debe empezar de cero.
  const epoch = session.user.createdAt;
  if (body.epoch !== null && body.epoch !== epoch) return json({ reset: true, epoch }, 409);

  const limit = new Date(nowMs + MAX_AHEAD_MS).toISOString();
  const nowIso = new Date(nowMs).toISOString();
  const changes = body.changes.map((c) => (c.updatedAt > limit ? { ...c, updatedAt: nowIso } : c));
  await applyChanges(env.DB, session.user.id, changes);

  const rows = await changesSince(env.DB, session.user.id, body.cursor, PULL_LIMIT);
  // Lo que el dispositivo acaba de subir no se le devuelve.
  const sent = new Set(changes.map(echoKey));
  const out: Change[] = [];
  let cursor = body.cursor;
  let chars = 0;
  let more = rows.length === PULL_LIMIT;
  for (const { seq, ...change } of rows) {
    const size = change.data?.length ?? 0;
    if (out.length > 0 && chars + size > PULL_CHARS) {
      more = true;
      break;
    }
    cursor = seq;
    if (sent.has(echoKey(change))) continue;
    out.push(change);
    chars += size;
  }
  return json({ epoch, cursor, changes: out, more } satisfies SyncResponse);
}
