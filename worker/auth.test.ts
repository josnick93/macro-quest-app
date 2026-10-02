import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { handleAuth, jwtPayload, sha256, userFromIdToken, type AuthDeps, type AuthEnv } from "./auth";
import type { Database } from "./store";

const ORIGIN = "https://app.test";
const CLIENT_ID = "cliente.apps.googleusercontent.com";
const NOW = Date.parse("2026-10-02T10:00:00.000Z");

const b64url = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const idToken = (claims: Record<string, unknown> = {}) =>
  `${b64url({ alg: "RS256" })}.${b64url({
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: NOW / 1000 + 3600,
    sub: "google-123",
    email: "ana@example.com",
    email_verified: true,
    name: "Ana Muñoz",
    ...claims,
  })}.firma`;

/** Base D1 real en local (miniflare), en memoria. */
let db: Database;
let dispose: () => Promise<void>;
beforeAll(async () => {
  const proxy = await getPlatformProxy<{ DB: Database }>({ persist: false });
  db = proxy.env.DB;
  dispose = proxy.dispose;
});
afterAll(() => dispose());

const env = (): AuthEnv => ({ DB: db, GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: "secreto" });
const google = (token: string | null, calls: RequestInit[] = []): AuthDeps => ({
  now: () => NOW,
  fetcher: async (_url, init) => {
    calls.push(init!);
    return token ? new Response(JSON.stringify({ id_token: token })) : new Response("{}", { status: 400 });
  },
});
const get = (path: string, cookie = "") => new Request(`${ORIGIN}/api/auth/${path}`, { headers: cookie ? { cookie } : {} });
const post = (path: string, cookie: string, origin = ORIGIN) => new Request(`${ORIGIN}/api/auth/${path}`, { method: "POST", headers: { cookie, origin } });
/** "nombre=valor" de la cookie que pone una respuesta. */
const cookieOf = (res: Response, name: string) => {
  const found = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return found ? found.split(";")[0]! : null;
};

/** Recorre el login completo y devuelve la cookie de sesión. */
async function signIn(token = idToken()): Promise<string> {
  const start = await handleAuth(get("login"), env(), google(null));
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const res = await handleAuth(get(`callback?code=abc&state=${state}`, cookieOf(start, "__Host-mq_oauth")!), env(), google(token));
  expect(res.headers.get("location")).toBe("/perfil?login=ok");
  return cookieOf(res, "__Host-mq_session")!;
}

describe("id_token de Google", () => {
  it("acepta uno válido (con tildes en el nombre)", () => {
    expect(userFromIdToken(idToken(), CLIENT_ID, NOW)).toEqual({ id: "google-123", email: "ana@example.com", name: "Ana Muñoz" });
  });
  it("rechaza tokens de otra app, caducados, de otro emisor o sin correo verificado", () => {
    expect(userFromIdToken(idToken({ aud: "otra-app" }), CLIENT_ID, NOW)).toBeNull();
    expect(userFromIdToken(idToken({ exp: NOW / 1000 - 1 }), CLIENT_ID, NOW)).toBeNull();
    expect(userFromIdToken(idToken({ iss: "https://malo.example" }), CLIENT_ID, NOW)).toBeNull();
    expect(userFromIdToken(idToken({ email_verified: false }), CLIENT_ID, NOW)).toBeNull();
    expect(userFromIdToken("no-es-un-jwt", CLIENT_ID, NOW)).toBeNull();
    expect(jwtPayload("a.b.c")).toBeNull();
  });
});

describe("sin configurar", () => {
  it("la app sabe que no hay login y el resto responde 503", async () => {
    expect(await (await handleAuth(get("me"), {})).json()).toEqual({ enabled: false, user: null });
    expect((await handleAuth(get("login"), { DB: db })).status).toBe(503);
  });
});

describe("inicio de sesión", () => {
  it("redirige a Google con el estado en una cookie de servidor", async () => {
    const res = await handleAuth(get("login"), env(), google(null));
    const target = new URL(res.headers.get("location")!);
    expect(target.origin + target.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(target.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(target.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback`);
    const set = res.headers.getSetCookie()[0]!;
    expect(set).toContain(`__Host-mq_oauth=${target.searchParams.get("state")}`);
    expect(set).toContain("HttpOnly");
    expect(set).toContain("Secure");
  });

  it("login completo: crea usuario y sesión, y /me lo reconoce", async () => {
    const calls: RequestInit[] = [];
    const start = await handleAuth(get("login"), env(), google(null));
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await handleAuth(get(`callback?code=abc&state=${state}`, cookieOf(start, "__Host-mq_oauth")!), env(), google(idToken(), calls));
    expect(res.status).toBe(302);
    expect(String(calls[0]!.body)).toContain("client_secret=secreto");
    const session = cookieOf(res, "__Host-mq_session")!;
    expect(await (await handleAuth(get("me", session), env(), google(null))).json()).toEqual({
      enabled: true,
      user: { email: "ana@example.com", name: "Ana Muñoz" },
    });
    // En la base solo está el hash del token, nunca el token.
    const token = session.split("=")[1]!;
    const row = await db.prepare("SELECT token_hash FROM sessions WHERE token_hash = ?1").bind(await sha256(token)).first<{ token_hash: string }>();
    expect(row?.token_hash).not.toBe(token);
    expect(row).not.toBeNull();
  });

  it("volver a entrar actualiza el usuario en vez de duplicarlo", async () => {
    await signIn();
    await signIn(idToken({ name: "Ana M." }));
    const rows = await db.prepare("SELECT COUNT(*) AS n, MAX(name) AS name FROM users WHERE id = ?1").bind("google-123").first<{ n: number; name: string }>();
    expect(rows).toEqual({ n: 1, name: "Ana M." });
  });

  it("rechaza un estado que no coincide, la cancelación y un token inválido", async () => {
    const start = await handleAuth(get("login"), env(), google(null));
    const stateCookie = cookieOf(start, "__Host-mq_oauth")!;
    const bad = await handleAuth(get("callback?code=abc&state=otro", stateCookie), env(), google(idToken()));
    expect(bad.headers.get("location")).toBe("/perfil?login=error");
    expect(cookieOf(bad, "__Host-mq_session")).toBeNull();
    const cancelled = await handleAuth(get("callback?error=access_denied", stateCookie), env(), google(idToken()));
    expect(cancelled.headers.get("location")).toBe("/perfil?login=cancelado");
    const state = stateCookie.split("=")[1]!;
    const forged = await handleAuth(get(`callback?code=abc&state=${state}`, stateCookie), env(), google(idToken({ aud: "otra-app" })));
    expect(forged.headers.get("location")).toBe("/perfil?login=error");
    const down = await handleAuth(get(`callback?code=abc&state=${state}`, stateCookie), env(), google(null));
    expect(down.headers.get("location")).toBe("/perfil?login=error");
  });

  it("una sesión inventada o caducada no vale", async () => {
    expect(await (await handleAuth(get("me", "__Host-mq_session=inventada"), env(), google(null))).json()).toMatchObject({ user: null });
    const session = await signIn();
    const later: AuthDeps = { ...google(null), now: () => NOW + 91 * 86_400_000 };
    expect(await (await handleAuth(get("me", session), env(), later)).json()).toMatchObject({ user: null });
  });
});

describe("cerrar sesión y borrar cuenta", () => {
  it("cerrar sesión invalida solo esa sesión", async () => {
    const a = await signIn();
    const b = await signIn();
    const res = await handleAuth(post("logout", a), env(), google(null));
    expect(res.headers.getSetCookie()[0]).toContain("Max-Age=0");
    expect(await (await handleAuth(get("me", a), env(), google(null))).json()).toMatchObject({ user: null });
    expect(await (await handleAuth(get("me", b), env(), google(null))).json()).toMatchObject({ user: { email: "ana@example.com" } });
  });

  it("no acepta peticiones de otro sitio", async () => {
    const session = await signIn();
    expect((await handleAuth(post("logout", session, "https://malo.example"), env(), google(null))).status).toBe(403);
    expect(await (await handleAuth(get("me", session), env(), google(null))).json()).toMatchObject({ user: { email: "ana@example.com" } });
  });

  it("borrar la cuenta elimina el usuario y todas sus sesiones", async () => {
    const a = await signIn();
    const b = await signIn();
    await handleAuth(post("delete", a), env(), google(null));
    expect(await (await handleAuth(get("me", b), env(), google(null))).json()).toMatchObject({ user: null });
    const left = await db.prepare("SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM sessions) AS sessions").first<{ users: number; sessions: number }>();
    expect(left).toEqual({ users: 0, sessions: 0 });
  });
});
