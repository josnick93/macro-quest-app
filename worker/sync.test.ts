import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { handleAuth, sha256, type AuthEnv } from "./auth";
import { handleSync } from "./sync";
import { createSession, ensureSchema, upsertUser, type Database } from "./store";
import type { Change, SyncResponse } from "../src/lib/syncApi";

const ORIGIN = "https://app.test";
const NOW = Date.parse("2026-10-02T10:00:00.000Z");
const at = (minutes: number) => new Date(NOW - 3_600_000 + minutes * 60_000).toISOString();

let db: Database;
let dispose: () => Promise<void>;
beforeAll(async () => {
  const proxy = await getPlatformProxy<{ DB: Database }>({ persist: false });
  db = proxy.env.DB;
  dispose = proxy.dispose;
  await ensureSchema(db);
});
afterAll(() => dispose());

const env = (): AuthEnv => ({ DB: db, GOOGLE_CLIENT_ID: "cliente", GOOGLE_CLIENT_SECRET: "secreto" });

let n = 0;
/** Usuario nuevo con sesión; devuelve su cookie. */
async function user(id = `u${++n}`, createdAt = at(0)): Promise<string> {
  const token = `token-${id}-${++n}`;
  await upsertUser(db, { id, email: `${id}@example.com`, name: null }, createdAt);
  await createSession(db, id, await sha256(token), at(0), new Date(NOW + 86_400_000).toISOString());
  return `__Host-mq_session=${token}`;
}

const entry = (key: string, minutes: number, name = key): Change => ({
  store: "diary",
  key,
  updatedAt: at(minutes),
  deleted: false,
  data: JSON.stringify({ id: key, name }),
});
const gone = (key: string, minutes: number): Change => ({ store: "diary", key, updatedAt: at(minutes), deleted: true, data: null });

function call(cookie: string, body: unknown, init: { origin?: string; method?: string } = {}) {
  const method = init.method ?? "POST";
  return handleSync(
    new Request(`${ORIGIN}/api/sync`, {
      method,
      headers: { cookie, origin: init.origin ?? ORIGIN, "content-type": "application/json" },
      body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : null,
    }),
    env(),
    () => NOW,
  );
}
async function sync(cookie: string, cursor: number, changes: Change[] = [], epoch: string | null = null): Promise<SyncResponse> {
  const res = await call(cookie, { epoch, cursor, changes });
  expect(res.status).toBe(200);
  return (await res.json()) as SyncResponse;
}

describe("acceso", () => {
  it("exige sesión, mismo origen y POST", async () => {
    const cookie = await user();
    expect((await call("", { epoch: null, cursor: 0, changes: [] })).status).toBe(401);
    expect((await call("__Host-mq_session=inventada", { epoch: null, cursor: 0, changes: [] })).status).toBe(401);
    expect((await call(cookie, { epoch: null, cursor: 0, changes: [] }, { origin: "https://malo.example" })).status).toBe(403);
    expect((await call(cookie, null, { method: "GET" })).status).toBe(405);
    expect((await handleSync(new Request(`${ORIGIN}/api/sync`, { method: "POST" }), {})).status).toBe(503);
  });

  it("rechaza peticiones mal formadas o demasiado grandes", async () => {
    const cookie = await user();
    expect((await call(cookie, "no es json")).status).toBe(400);
    expect((await call(cookie, { epoch: null, cursor: -1, changes: [] })).status).toBe(400);
    expect((await call(cookie, { epoch: null, cursor: 0, changes: [{ store: "users", key: "a", updatedAt: at(1), deleted: true }] })).status).toBe(400);
    expect((await call(cookie, { epoch: null, cursor: 0, changes: [{ ...entry("a", 1), updatedAt: "ayer" }] })).status).toBe(400);
    expect((await call(cookie, { epoch: null, cursor: 0, changes: [{ store: "kv", key: "sync", updatedAt: at(1), deleted: false, data: "{}" }] })).status).toBe(400);
    expect((await call(cookie, { epoch: null, cursor: 0, changes: Array.from({ length: 201 }, (_, i) => entry(`e${i}`, 1)) })).status).toBe(400);
    expect((await call(cookie, "x".repeat(600_001))).status).toBe(413);
  });
});

describe("subir y bajar", () => {
  it("un dispositivo sube y otro recibe; lo propio no se devuelve", async () => {
    const cookie = await user();
    const a = await sync(cookie, 0, [entry("e1", 1), entry("e2", 2)]);
    expect(a.changes).toEqual([]);
    expect(a.cursor).toBe(2);

    const b = await sync(cookie, 0);
    expect(b.changes.map((c) => c.key)).toEqual(["e1", "e2"]);
    expect(JSON.parse(b.changes[0]!.data!)).toEqual({ id: "e1", name: "e1" });
    expect(b.cursor).toBe(2);
    expect(b.more).toBe(false);
    // Nada nuevo desde ahí.
    expect((await sync(cookie, b.cursor)).changes).toEqual([]);
  });

  it("gana el cambio más reciente, llegue en el orden que llegue", async () => {
    const cookie = await user();
    await sync(cookie, 0, [entry("e1", 10, "nuevo")]);
    // Un dispositivo atrasado sube una versión anterior: se ignora y recibe la buena.
    const late = await sync(cookie, 0, [entry("e1", 5, "viejo")]);
    expect(late.changes).toHaveLength(1);
    expect(JSON.parse(late.changes[0]!.data!).name).toBe("nuevo");
    // Con la misma fecha no se pisa.
    await sync(cookie, 0, [entry("e1", 10, "empate")]);
    expect(JSON.parse((await sync(cookie, 0)).changes[0]!.data!).name).toBe("nuevo");
  });

  it("los borrados se propagan y un borrado antiguo no pisa una edición posterior", async () => {
    const cookie = await user();
    const first = await sync(cookie, 0, [entry("e1", 1), entry("e2", 1)]);
    await sync(cookie, first.cursor, [gone("e1", 5)]);
    const other = await sync(cookie, first.cursor);
    expect(other.changes).toEqual([gone("e1", 5)]);

    await sync(cookie, 0, [gone("e2", 0)]);
    const all = await sync(cookie, 0);
    expect(all.changes.find((c) => c.key === "e2")?.deleted).toBe(false);
    // Restaurar (deshacer) después del borrado sí gana.
    await sync(cookie, 0, [entry("e1", 8, "restaurado")]);
    expect((await sync(cookie, 0)).changes.find((c) => c.key === "e1")).toMatchObject({ deleted: false });
  });

  it("un cambio modificado vuelve a salir para quien ya lo tenía", async () => {
    const cookie = await user();
    const a = await sync(cookie, 0, [entry("e1", 1), entry("e2", 1)]);
    await sync(cookie, a.cursor, [entry("e1", 3, "editado")]);
    const b = await sync(cookie, a.cursor);
    expect(b.changes.map((c) => c.key)).toEqual(["e1"]);
    expect(b.cursor).toBeGreaterThan(a.cursor);
  });

  it("los datos de un usuario no los ve otro", async () => {
    const ana = await user();
    const luis = await user();
    await sync(ana, 0, [entry("e1", 1)]);
    expect((await sync(luis, 0)).changes).toEqual([]);
    await sync(luis, 0, [entry("e1", 2, "de luis")]);
    expect(JSON.parse((await sync(ana, 0)).changes[0]!.data!).name).toBe("e1");
  });

  it("una fecha del futuro se guarda como ahora, para que no gane siempre", async () => {
    const cookie = await user();
    await sync(cookie, 0, [entry("e1", 60 + 24 * 60)]);
    const res = await sync(cookie, 0);
    expect(res.changes[0]!.updatedAt).toBe(new Date(NOW).toISOString());
  });

  it("baja por páginas cuando hay muchos cambios", async () => {
    const cookie = await user();
    for (let page = 0; page < 3; page++) {
      await sync(cookie, 0, Array.from({ length: 200 }, (_, i) => entry(`p${page}-${i}`, 1)));
    }
    const first = await sync(cookie, 0);
    expect(first.changes).toHaveLength(500);
    expect(first.more).toBe(true);
    const rest = await sync(cookie, first.cursor);
    expect(rest.changes).toHaveLength(100);
    expect(rest.more).toBe(false);
  });
});

describe("cuenta", () => {
  it("si la copia del servidor es otra (cuenta borrada y creada de nuevo), pide empezar de cero", async () => {
    const cookie = await user("volver", at(0));
    const first = await sync(cookie, 0, [entry("e1", 1)]);
    expect(first.epoch).toBe(at(0));
    expect((await call(cookie, { epoch: first.epoch, cursor: first.cursor, changes: [] })).status).toBe(200);
    const res = await call(cookie, { epoch: at(-500), cursor: 7, changes: [entry("e9", 2)] });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ reset: true, epoch: at(0) });
    // No se ha aplicado nada.
    expect((await sync(cookie, 0)).changes.map((c) => c.key)).toEqual(["e1"]);
  });

  it("borrar la cuenta borra también la copia de los datos", async () => {
    const cookie = await user("adios");
    await sync(cookie, 0, [entry("e1", 1)]);
    await handleAuth(new Request(`${ORIGIN}/api/auth/delete`, { method: "POST", headers: { cookie, origin: ORIGIN } }), env());
    const left = await db.prepare("SELECT COUNT(*) AS n FROM records WHERE user_id = ?1").bind("adios").first<{ n: number }>();
    expect(left).toEqual({ n: 0 });
  });
});
