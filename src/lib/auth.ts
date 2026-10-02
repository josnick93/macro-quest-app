/** Sesión del usuario contra el servidor de la app (/api/auth/*). Sin servidor o sin red, la app sigue en local. */

export interface SessionUser {
  email: string;
  name: string | null;
}

export interface SessionInfo {
  /** false si el servidor no tiene el login configurado o no se ha podido consultar. */
  enabled: boolean;
  user: SessionUser | null;
}

const NONE: SessionInfo = { enabled: false, user: null };

export async function fetchSession(): Promise<SessionInfo> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return NONE;
    const data = (await res.json()) as Partial<SessionInfo>;
    return { enabled: data.enabled === true, user: data.user ?? null };
  } catch {
    return NONE;
  }
}

/** El login es una navegación completa: Google y vuelta. */
export const startLogin = () => location.assign("/api/auth/login");

async function post(path: string): Promise<void> {
  const res = await fetch(path, { method: "POST", credentials: "same-origin" });
  if (!res.ok) throw new Error(res.status === 503 ? "El inicio de sesión no está disponible" : `El servidor respondió ${res.status}`);
}

export const logout = () => post("/api/auth/logout");
export const deleteAccount = () => post("/api/auth/delete");

/** Mensaje para el resultado que el servidor deja en ?login= al volver de Google. */
export function loginMessage(result: string | null): { ok: boolean; text: string } | null {
  if (result === "ok") return { ok: true, text: "Sesión iniciada" };
  if (result === "cancelado") return { ok: false, text: "Has cancelado el inicio de sesión" };
  if (result === "error") return { ok: false, text: "No se pudo iniciar sesión. Inténtalo de nuevo." };
  return null;
}
