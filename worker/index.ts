/**
 * Servidor intermedio (Cloudflare Worker) entre la app y Open Food Facts.
 * - Reintenta los 503 intermitentes de OFF, que el navegador ve como fallo de red.
 * - Guarda las respuestas en la caché de Cloudflare: una búsqueda repetida no vuelve a OFF.
 * - Si en España no hay resultados, busca en todo el catálogo.
 * Todo lo que no sea /api/* se sirve desde los archivos estáticos de la app.
 */
import { isBarcode, MAX_REMOTE_QUERY, MIN_REMOTE_QUERY, normalizeQuery, productUrl, searchUrl, type SearchScope } from "../src/lib/offApi";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}
interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** OFF pide que cada aplicación se identifique. */
const USER_AGENT = "MacroQuest/1.0 (+https://github.com/josnick93/macro-quest-app)";

const HOUR = 3600;
const DAY = 24 * HOUR;

/** `edge`: segundos en la caché de Cloudflare · el navegador guarda como mucho 5 minutos. */
export function json(body: unknown, status = 200, edge = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": edge > 0 ? `public, max-age=${Math.min(edge, 300)}, s-maxage=${edge}` : "no-store",
    },
  });
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Petición a OFF con reintentos ante 5xx, 429 o fallo de red. */
export async function upstream(url: string, fetcher: Fetcher = fetch, attempts = 3, wait: (ms: number) => Promise<void> = sleep): Promise<Response> {
  let last: Response | undefined;
  let error: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await wait(500 * i);
    try {
      const res = await fetcher(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" } });
      if (res.status < 500 && res.status !== 429) return res;
      last = res;
    } catch (e) {
      error = e;
    }
  }
  if (last) return last;
  throw error;
}

export async function search(query: string, fetcher: Fetcher = fetch, wait?: (ms: number) => Promise<void>): Promise<Response> {
  const q = normalizeQuery(query);
  if (q.length < MIN_REMOTE_QUERY || q.length > MAX_REMOTE_QUERY) return json({ error: "Búsqueda no válida" }, 400);
  for (const scope of ["es", "world"] as SearchScope[]) {
    const res = await upstream(searchUrl(q, scope), fetcher, 3, wait);
    if (!res.ok) return json({ error: `Open Food Facts respondió ${res.status}` }, 502);
    const products = ((await res.json()) as { products?: unknown[] }).products ?? [];
    if (products.length > 0) return json({ products, scope }, 200, DAY);
  }
  // Sin resultados: se guarda poco tiempo, por si el producto se da de alta.
  return json({ products: [], scope: "world" }, 200, HOUR);
}

export async function product(code: string, fetcher: Fetcher = fetch, wait?: (ms: number) => Promise<void>): Promise<Response> {
  if (!isBarcode(code)) return json({ error: "Código no válido" }, 400);
  const res = await upstream(productUrl(code), fetcher, 3, wait);
  if (res.status === 404) return json({ product: null }, 200, HOUR);
  if (!res.ok) return json({ error: `Open Food Facts respondió ${res.status}` }, 502);
  const body = (await res.json()) as { product?: unknown };
  return body.product ? json({ product: body.product }, 200, 7 * DAY) : json({ product: null }, 200, HOUR);
}

/** Resuelve /api/*; null si la ruta no existe. */
export function route(url: URL): (() => Promise<Response>) | null {
  if (url.pathname === "/api/off/search") return () => search(url.searchParams.get("q") ?? "");
  const m = /^\/api\/off\/product\/([^/]+)$/.exec(url.pathname);
  if (m) return () => product(decodeURIComponent(m[1]!));
  return null;
}

/** Clave de caché: la ruta con la búsqueda normalizada, para que "Yogur " y "yogur" compartan entrada. */
export function cacheKey(url: URL): string {
  const key = new URL(url.pathname, url.origin);
  const q = url.searchParams.get("q");
  if (q !== null) key.searchParams.set("q", normalizeQuery(q));
  return key.toString();
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (request.method !== "GET") return json({ error: "Método no permitido" }, 405);
    const handler = route(url);
    if (!handler) return json({ error: "No existe" }, 404);

    const cache = (caches as unknown as { default: Cache }).default;
    const key = new Request(cacheKey(url));
    const hit = await cache.match(key);
    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set("x-cache", "hit");
      return res;
    }
    try {
      const res = await handler();
      if (res.status === 200) ctx.waitUntil(cache.put(key, res.clone()));
      res.headers.set("x-cache", "miss");
      return res;
    } catch {
      return json({ error: "Open Food Facts no responde" }, 502);
    }
  },
};
