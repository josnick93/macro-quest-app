/**
 * Dominio propio. La app nació en workers.dev y se ha mudado a macroquestapp.com; lo comparten la app y el worker.
 * - Sin sesión (visitas nuevas, buscadores): el worker redirige con un 301.
 * - Con sesión: la app abre normal, sube lo pendiente y luego lleva al dominio nuevo (cada dominio guarda sus datos aparte,
 *   así que redirigir antes perdería lo que aún no está en la nube).
 */

export const CANONICAL_ORIGIN = "https://macroquestapp.com";
const SESSION_COOKIE = "__Host-mq_session";

export const isLegacyHost = (hostname: string) => hostname.endsWith(".workers.dev");

/** La misma ruta en el dominio nuevo. */
export const canonicalUrl = (url: URL) => `${CANONICAL_ORIGIN}${url.pathname}${url.search}${url.hash}`;

/**
 * Adónde redirigir una petición al dominio viejo, o null si se sirve normal: la API (para que las sesiones abiertas sigan
 * sincronizando), el service worker (para que se actualice) y las visitas con sesión (las mueve la app).
 */
export function legacyRedirect(method: string, url: URL, cookie: string | null): string | null {
  if (!isLegacyHost(url.hostname)) return null;
  if (method !== "GET" && method !== "HEAD") return null;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return null;
  const signedIn = (cookie ?? "").split(";").some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
  return signedIn ? null : canonicalUrl(url);
}
