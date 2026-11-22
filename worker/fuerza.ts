/**
 * Entrenos de Cazador de Fuerza de la cuenta (GET /api/fuerza). Cazador comparte esta D1 y guarda sus datos en
 * `fuerza_records` (una fila por entreno, store = 'workouts'). Aquí solo se LEE; nunca se escribe en esa tabla.
 */
import { currentUser, enabled, type AuthEnv } from "./auth";
import { json } from "./http";
import type { Database } from "./store";
import { FUERZA_DAYS, FUERZA_LIFTS, type FuerzaResponse, type FuerzaWorkout } from "../src/lib/fuerzaApi";

const NOT_CONNECTED: FuerzaResponse = { connected: false, plannedPerWeek: null, workouts: [] };
const LIFT_IDS = new Set<string>(FUERZA_LIFTS.map((l) => l.id));

interface RawSet {
  e1rm?: unknown;
  isPr?: unknown;
}
interface RawWorkout {
  completedAt?: unknown;
  title?: unknown;
  exercises?: { exerciseId?: unknown; sets?: RawSet[] }[];
}

/** Reduce un entreno de Cazador a lo que muestra MacroQuest; null si no tiene la forma esperada. */
export function reduceWorkout(raw: RawWorkout): FuerzaWorkout | null {
  if (typeof raw.completedAt !== "string" || !Array.isArray(raw.exercises)) return null;
  const lifts: Record<string, number> = {};
  let prs = 0;
  for (const ex of raw.exercises) {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    prs += sets.filter((s) => s.isPr === true).length;
    if (typeof ex.exerciseId !== "string" || !LIFT_IDS.has(ex.exerciseId)) continue;
    for (const s of sets) {
      if (typeof s.e1rm === "number" && s.e1rm > (lifts[ex.exerciseId] ?? 0)) lifts[ex.exerciseId] = s.e1rm;
    }
  }
  return { completedAt: raw.completedAt, title: typeof raw.title === "string" ? raw.title : "Entreno", prs, lifts };
}

export async function readFuerza(db: Database, userId: string, since: string): Promise<FuerzaResponse> {
  try {
    const { results } = await db
      .prepare(
        `SELECT store, data FROM fuerza_records
         WHERE user_id = ?1 AND deleted = 0
           AND ((store = 'workouts' AND json_extract(data, '$.completedAt') >= ?2) OR (store = 'profile' AND key = 'me'))`,
      )
      .bind(userId, since)
      .all<{ store: string; data: string }>();
    let plannedPerWeek: number | null = null;
    const workouts: FuerzaWorkout[] = [];
    for (const row of results) {
      let value: unknown;
      try {
        value = JSON.parse(row.data);
      } catch {
        continue;
      }
      if (typeof value !== "object" || value === null) continue;
      if (row.store === "profile") {
        const days = (value as { daysPerWeek?: unknown }).daysPerWeek;
        plannedPerWeek = typeof days === "number" && days > 0 ? days : null;
      } else {
        const w = reduceWorkout(value as RawWorkout);
        if (w) workouts.push(w);
      }
    }
    workouts.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
    return { connected: results.length > 0, plannedPerWeek, workouts };
  } catch (e) {
    // Cazador nunca ha arrancado con esta base: no existe su tabla.
    if (String(e).includes("no such table")) return NOT_CONNECTED;
    throw e;
  }
}

export async function handleFuerza(request: Request, env: AuthEnv, now: () => number = () => Date.now()): Promise<Response> {
  if (!enabled(env)) return json({ error: "El inicio de sesión no está configurado" }, 503);
  if (request.method !== "GET") return json({ error: "Método no permitido" }, 405);
  const nowMs = now();
  const session = await currentUser(request, env, nowMs);
  if (!session) return json({ error: "Sesión no válida" }, 401);
  const since = new Date(nowMs - FUERZA_DAYS * 86_400_000).toISOString();
  return json(await readFuerza(env.DB, session.user.id, since));
}
