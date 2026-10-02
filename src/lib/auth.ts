/** Sesión del usuario contra el servidor de la app (/api/auth/*). */

export interface SessionUser {
  /** Identificador estable de la cuenta; ata los datos de este dispositivo a su dueño. */
  id: string;
  email: string;
  name: string | null;
}

export interface SessionInfo {
  /** false si el servidor no tiene el login configurado (o no hay servidor, como en desarrollo). */
  enabled: boolean;
  user: SessionUser | null;
  /** No se ha podido preguntar al servidor (sin conexión o servidor caído). */
  offline: boolean;
}

const NO_SERVER: SessionInfo = { enabled: false, user: null, offline: false };
const OFFLINE: SessionInfo = { enabled: false, user: null, offline: true };

function sessionUser(v: unknown): SessionUser | null {
  if (typeof v !== "object" || v === null) return null;
  const u = v as Record<string, unknown>;
  if (typeof u.id !== "string" || !u.id || typeof u.email !== "string" || !u.email) return null;
  return { id: u.id, email: u.email, name: typeof u.name === "string" && u.name ? u.name : null };
}

export async function fetchSession(): Promise<SessionInfo> {
  let res: Response;
  try {
    res = await fetch("/api/auth/me", { credentials: "same-origin" });
  } catch {
    return OFFLINE;
  }
  if (res.status >= 500) return OFFLINE;
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) return NO_SERVER;
  try {
    const data = (await res.json()) as { enabled?: unknown; user?: unknown };
    return { enabled: data.enabled === true, user: sessionUser(data.user), offline: false };
  } catch {
    return OFFLINE;
  }
}

// ---------- cuenta recordada en este dispositivo ----------

const ACCOUNT_KEY = "mq:account";

/** Última cuenta con la que se entró aquí: permite abrir la app sin conexión. */
export function rememberedAccount(): SessionUser | null {
  try {
    return sessionUser(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null"));
  } catch {
    return null;
  }
}

export function rememberAccount(user: SessionUser | null): void {
  try {
    if (user) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(user));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* sin almacenamiento: sin conexión habrá que volver a entrar */
  }
}

/** Sesión del servidor, dejando apuntada la cuenta (o su ausencia) para la próxima vez. */
export async function loadSession(): Promise<SessionInfo> {
  const session = await fetchSession();
  if (session.user) rememberAccount(session.user);
  else if (!session.offline) rememberAccount(null);
  return session;
}

// ---------- puerta de entrada ----------

/** loading: aún no se sabe · open: se puede usar la app · login: hay que entrar con Google. */
export type Gate = "loading" | "open" | "login";

/**
 * Entrar es obligatorio donde el servidor tiene login. Sin conexión vale la cuenta recordada,
 * y sin servidor de login (desarrollo) la app funciona sin cuentas.
 */
export function gate(session: SessionInfo | undefined, remembered: SessionUser | null): Gate {
  if (!session) return remembered ? "open" : "loading";
  if (session.offline) return remembered ? "open" : "login";
  if (!session.enabled) return "open";
  return session.user ? "open" : "login";
}

/** Cuenta en uso: la de la sesión o, sin conexión, la recordada. */
export function activeAccount(session: SessionInfo | undefined, remembered: SessionUser | null): SessionUser | null {
  if (!session || session.offline) return remembered;
  return session.user;
}

/** El login es una navegación completa: Google y vuelta. */
export const startLogin = () => location.assign("/api/auth/login");

async function post(path: string): Promise<void> {
  const res = await fetch(path, { method: "POST", credentials: "same-origin" });
  if (!res.ok) throw new Error(res.status === 503 ? "El inicio de sesión no está disponible" : `El servidor respondió ${res.status}`);
}

export const logout = () => post("/api/auth/logout");
export const deleteAccount = () => post("/api/auth/delete");

/** Mensaje para el resultado que el servidor deja en ?login= (y ?motivo= si falla) al volver de Google. */
export function loginMessage(result: string | null, motivo: string | null = null): { ok: boolean; text: string } | null {
  if (result === "ok") return { ok: true, text: "Sesión iniciada" };
  if (result === "cancelado") return { ok: false, text: "Has cancelado el inicio de sesión" };
  if (result === "error") {
    const code = motivo && /^[a-z0-9_]{1,60}$/.test(motivo) ? ` (${motivo})` : "";
    return { ok: false, text: `No se pudo iniciar sesión${code}. Inténtalo de nuevo.` };
  }
  return null;
}
