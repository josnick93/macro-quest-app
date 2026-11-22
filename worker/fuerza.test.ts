import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { sha256 } from "./auth";
import { handleFuerza, readFuerza, reduceWorkout } from "./fuerza";
import { createSession, ensureSchema, upsertUser, type Database } from "./store";

const NOW = Date.parse("2026-11-22T10:00:00.000Z");
let db: Database;
let dispose: () => Promise<void>;
beforeAll(async () => {
  const proxy = await getPlatformProxy<{ DB: Database }>({ persist: false });
  db = proxy.env.DB;
  dispose = proxy.dispose;
  await ensureSchema(db);
});
afterAll(() => dispose());

/** La tabla que crea Cazador de Fuerza en la misma base. */
const createFuerzaTable = () =>
  db
    .prepare(
      `CREATE TABLE IF NOT EXISTS fuerza_records (user_id TEXT NOT NULL, store TEXT NOT NULL, key TEXT NOT NULL,
       updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, data TEXT, seq INTEGER NOT NULL, PRIMARY KEY (user_id, store, key))`,
    )
    .run();

let seq = 0;
const put = (user: string, store: string, key: string, data: unknown, deleted = 0) =>
  db
    .prepare(`INSERT INTO fuerza_records (user_id, store, key, updated_at, deleted, data, seq) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(user, store, key, "2026-11-20T00:00:00.000Z", deleted, JSON.stringify(data), ++seq)
    .run();

const workout = (id: string, completedAt: string, sets: { exerciseId: string; e1rm: number; isPr?: boolean }[]) => ({
  id,
  title: `Entreno ${id}`,
  completedAt,
  exercises: sets.map((s) => ({ exerciseId: s.exerciseId, plannedExerciseId: s.exerciseId, sets: [{ kg: 80, reps: 5, rir: 2, e1rm: s.e1rm, isPr: s.isPr ?? false }] })),
});

describe("entrenos de Cazador de Fuerza", () => {
  it("reduce un entreno a los básicos y cuenta los PRs de todos los ejercicios", () => {
    expect(
      reduceWorkout(
        workout("w", "2026-11-20T18:00:00.000Z", [
          { exerciseId: "ex-banca-barra", e1rm: 100, isPr: true },
          { exerciseId: "ex-curl-barra", e1rm: 40, isPr: true },
        ]),
      ),
    ).toEqual({ completedAt: "2026-11-20T18:00:00.000Z", title: "Entreno w", prs: 2, lifts: { "ex-banca-barra": 100 } });
    expect(reduceWorkout({ title: "sin fecha" })).toBeNull();
  });

  it("sin la tabla de Cazador la cuenta no está conectada", async () => {
    expect(await readFuerza(db, "ana", "2026-10-01")).toEqual({ connected: false, plannedPerWeek: null, workouts: [] });
  });

  it("lee los entrenos recientes y los días del plan, sin borrados, antiguos ni de otra cuenta", async () => {
    await createFuerzaTable();
    await put("ana", "profile", "me", { daysPerWeek: 4 });
    await put("ana", "workouts", "w1", workout("w1", "2026-11-18T18:00:00.000Z", [{ exerciseId: "ex-banca-barra", e1rm: 100 }]));
    await put("ana", "workouts", "w2", workout("w2", "2026-11-20T18:00:00.000Z", [{ exerciseId: "ex-sentadilla", e1rm: 140 }]));
    await put("ana", "workouts", "w3", workout("w3", "2026-11-19T18:00:00.000Z", []), 1);
    await put("ana", "workouts", "w0", workout("w0", "2026-09-01T18:00:00.000Z", []));
    await put("bea", "workouts", "b1", workout("b1", "2026-11-20T18:00:00.000Z", []));
    const res = await readFuerza(db, "ana", "2026-10-18T00:00:00.000Z");
    expect(res.connected).toBe(true);
    expect(res.plannedPerWeek).toBe(4);
    expect(res.workouts.map((w) => w.title)).toEqual(["Entreno w1", "Entreno w2"]);
  });

  it("el endpoint exige sesión", async () => {
    const env = { DB: db, GOOGLE_CLIENT_ID: "c", GOOGLE_CLIENT_SECRET: "s" };
    expect((await handleFuerza(new Request("https://app.test/api/fuerza"), env, () => NOW)).status).toBe(401);
    await upsertUser(db, { id: "ana", email: "ana@example.com", name: null }, "2026-11-01T00:00:00.000Z");
    await createSession(db, "ana", await sha256("tok"), "2026-11-01T00:00:00.000Z", "2099-01-01T00:00:00.000Z");
    const res = await handleFuerza(new Request("https://app.test/api/fuerza", { headers: { cookie: "__Host-mq_session=tok" } }), env, () => NOW);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ connected: true, plannedPerWeek: 4 });
  });
});
