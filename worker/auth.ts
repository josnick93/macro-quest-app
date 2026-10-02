/**
 * Login con Google (OAuth 2.0, flujo de código en servidor) y sesiones propias.
 * El navegador nunca ve el secreto de Google ni el token de sesión (cookie HttpOnly).
 */
import { cookie, json, readCookie, redirect } from "./http";
import { createSession, deleteSession, deleteUser, ensureSchema, sessionUser, upsertUser, type Account, type Database, type User } from "./store";

export interface AuthEnv {
  DB?: Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export interface AuthDeps {
  fetcher: (url: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
}

const SESSION_COOKIE = "__Host-mq_session";
const STATE_COOKIE = "__Host-mq_oauth";
const SESSION_DAYS = 90;
const STATE_SECONDS = 600;
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
/** Adónde vuelve la app tras el login; `login` le dice qué ha pasado. */
const AFTER = "/";

export const enabled = (env: AuthEnv): env is Required<AuthEnv> => !!(env.DB && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

function randomToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Contenido de un JWT sin verificar la firma (solo válido si llega directo de Google por HTTPS). */
export function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(part), (c) => c.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Usuario a partir del id_token de Google; null si no es para esta app, ha caducado o el correo no está verificado. */
export function userFromIdToken(idToken: string, clientId: string, nowMs: number): User | null {
  const p = jwtPayload(idToken);
  if (!p) return null;
  const issuerOk = p.iss === "https://accounts.google.com" || p.iss === "accounts.google.com";
  if (!issuerOk || p.aud !== clientId) return null;
  if (typeof p.exp !== "number" || p.exp * 1000 <= nowMs) return null;
  if (typeof p.sub !== "string" || !p.sub || typeof p.email !== "string" || !p.email) return null;
  if (p.email_verified !== true && p.email_verified !== "true") return null;
  return { id: p.sub, email: p.email, name: typeof p.name === "string" && p.name ? p.name : null };
}

const callbackUrl = (url: URL) => `${url.origin}/api/auth/callback`;

/** Usuario de la sesión de esta petición, si la cookie es válida. */
export async function currentUser(request: Request, env: Required<AuthEnv>, nowMs: number): Promise<{ user: Account; tokenHash: string } | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  await ensureSchema(env.DB);
  const tokenHash = await sha256(token);
  const user = await sessionUser(env.DB, tokenHash, new Date(nowMs).toISOString());
  return user ? { user, tokenHash } : null;
}

function login(url: URL, env: Required<AuthEnv>): Response {
  const state = randomToken(16);
  const target = new URL(GOOGLE_AUTH);
  target.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(url),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return redirect(target.toString(), [cookie(STATE_COOKIE, state, STATE_SECONDS)]);
}

/** Código corto del error que devuelve Google al canjear el código (p. ej. invalid_client). Nunca incluye datos secretos. */
async function googleError(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: unknown }).error;
    if (typeof code === "string" && /^[a-z_]{1,40}$/.test(code)) return code;
  } catch {
    // Respuesta sin JSON: basta con el estado HTTP.
  }
  return `http_${res.status}`;
}

async function callback(request: Request, url: URL, env: Required<AuthEnv>, deps: AuthDeps): Promise<Response> {
  const clearState = cookie(STATE_COOKIE, "", 0);
  // `motivo` dice en qué paso ha fallado; se ve en el aviso de la app y en los registros del worker.
  const fail = (motivo: string) => {
    console.warn(`login fallido: ${motivo}`);
    return redirect(`${AFTER}?login=error&motivo=${motivo}`, [clearState]);
  };

  if (url.searchParams.get("error")) return redirect(`${AFTER}?login=cancelado`, [clearState]);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("respuesta");
  // El `state` debe coincidir con el que se dio a este navegador: evita que otro sitio inicie el login por ti.
  const expected = readCookie(request, STATE_COOKIE);
  if (!expected) return fail("sin_cookie");
  if (state !== expected) return fail("estado");

  let user: User | null = null;
  try {
    const res = await deps.fetcher(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl(url),
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!res.ok) return fail(`google_${await googleError(res)}`);
    const idToken = ((await res.json()) as { id_token?: unknown }).id_token;
    if (typeof idToken === "string") user = userFromIdToken(idToken, env.GOOGLE_CLIENT_ID, deps.now());
  } catch (e) {
    console.error("login: fallo al hablar con Google", e);
    return fail("red");
  }
  if (!user) return fail("identidad");

  const nowMs = deps.now();
  const now = new Date(nowMs).toISOString();
  const expires = new Date(nowMs + SESSION_DAYS * 86_400_000).toISOString();
  const token = randomToken();
  try {
    await ensureSchema(env.DB);
    await upsertUser(env.DB, user, now);
    await createSession(env.DB, user.id, await sha256(token), now, expires);
  } catch (e) {
    console.error("login: fallo de la base de datos", e);
    return fail("base");
  }
  return redirect(`${AFTER}?login=ok`, [clearState, cookie(SESSION_COOKIE, token, SESSION_DAYS * 86_400)]);
}

// `fetch` y `Date.now` van envueltos: en Workers, llamarlos como método de otro objeto lanza «Illegal invocation».
const DEFAULT_DEPS: AuthDeps = { fetcher: (url, init) => fetch(url, init), now: () => Date.now() };

/** Atiende /api/auth/*. */
export async function handleAuth(request: Request, env: AuthEnv, deps: AuthDeps = DEFAULT_DEPS): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice("/api/auth/".length);

  if (!enabled(env)) {
    // Sin configurar (faltan los secretos de Google o la base): la app funciona sin cuentas.
    return path === "me" ? json({ enabled: false, user: null }) : json({ error: "El inicio de sesión no está configurado" }, 503);
  }

  if (request.method === "GET") {
    if (path === "me") {
      const session = await currentUser(request, env, deps.now());
      return json({ enabled: true, user: session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null });
    }
    if (path === "login") return login(url, env);
    if (path === "callback") return callback(request, url, env, deps);
    return json({ error: "No existe" }, 404);
  }

  if (request.method === "POST" && (path === "logout" || path === "delete")) {
    // Solo se aceptan peticiones hechas desde la propia app.
    if (request.headers.get("origin") !== url.origin) return json({ error: "Origen no permitido" }, 403);
    const session = await currentUser(request, env, deps.now());
    if (session) {
      if (path === "delete") await deleteUser(env.DB, session.user.id);
      else await deleteSession(env.DB, session.tokenHash);
    }
    const res = json({ ok: true });
    res.headers.append("set-cookie", cookie(SESSION_COOKIE, "", 0));
    return res;
  }

  return json({ error: "Método no permitido" }, 405);
}
