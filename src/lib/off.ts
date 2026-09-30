import type { Food, Nutrients, Serving } from "./types";

/** Open Food Facts (licencia ODbL). Llamadas directas desde el navegador (OFF permite CORS). */
const BASE = "https://world.openfoodfacts.org";
const FIELDS = [
  "code",
  "product_name",
  "product_name_es",
  "brands",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "product_quantity",
].join(",");

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
  serving_size?: string;
  serving_quantity?: number | string;
  product_quantity?: number | string;
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
};

/** Valor opcional: undefined si OFF no lo trae (0 es un valor válido). */
const opt = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
};

export function toFood(p: OffProduct): Food | null {
  const name = (p.product_name_es || p.product_name || "").trim();
  if (!name) return null;
  const n = p.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]) || Math.round(num(n["energy_100g"]) / 4.184);
  const per100g: Nutrients = {
    kcal,
    protein: num(n["proteins_100g"]),
    carbs: num(n["carbohydrates_100g"]),
    fat: num(n["fat_100g"]),
  };
  if (!per100g.kcal && !per100g.protein && !per100g.carbs && !per100g.fat) return null;
  const fiber = opt(n["fiber_100g"]);
  const sugar = opt(n["sugars_100g"]);
  const satFat = opt(n["saturated-fat_100g"]);
  const salt = opt(n["salt_100g"]) ?? (opt(n["sodium_100g"]) !== undefined ? Math.round(opt(n["sodium_100g"])! * 2.5 * 100) / 100 : undefined);
  if (fiber !== undefined) per100g.fiber = fiber;
  if (sugar !== undefined) per100g.sugar = sugar;
  if (satFat !== undefined) per100g.satFat = satFat;
  if (salt !== undefined) per100g.salt = salt;

  const servings: Serving[] = [];
  const sq = num(p.serving_quantity);
  if (sq > 0) servings.push({ label: p.serving_size?.trim() ? `ración ${p.serving_size.trim()}` : "ración", grams: sq });
  const pq = num(p.product_quantity);
  if (pq > 0 && pq !== sq && pq <= 5000) servings.push({ label: "envase", grams: pq });

  const food: Food = {
    id: p.code ? `off:${p.code}` : `off:${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    brand: p.brands?.split(",")[0]?.trim() || undefined,
    barcode: p.code || undefined,
    per100g,
    source: "off",
  };
  if (servings.length) food.servings = servings;
  return food;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * La búsqueda de OFF devuelve 503 de forma intermitente (y sin cabeceras CORS, así que el
 * navegador lo ve como error de red). Reintentar con espera lo resuelve casi siempre.
 */
async function fetchWithRetry(url: string, signal?: AbortSignal, attempts = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(700 * i, signal);
    try {
      const res = await fetch(url, { signal });
      if (res.ok) return res;
      last = new Error(`Open Food Facts respondió ${res.status}`);
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      last = e;
    }
  }
  throw last;
}

/** Caché en memoria de búsquedas (la sesión dura poco en móvil; basta para no repetir peticiones). */
const cache = new Map<string, Food[]>();
const CACHE_MAX = 60;
/** OFF limita la búsqueda (~10 peticiones/min por IP): solo se consulta a partir de 3 letras. */
export const MIN_REMOTE_QUERY = 3;

export async function searchFoods(query: string, signal?: AbortSignal): Promise<Food[]> {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_REMOTE_QUERY) return [];
  const hit = cache.get(q);
  if (hit) return hit;
  const url =
    `${BASE}/cgi/search.pl?` +
    new URLSearchParams({
      search_terms: q,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "25",
      countries_tags_en: "spain",
      fields: FIELDS,
    }).toString();
  const res = await fetchWithRetry(url, signal);
  const json = (await res.json()) as { products?: OffProduct[] };
  const foods = (json.products ?? []).map(toFood).filter((f): f is Food => f !== null);
  const seen = new Set<string>();
  const out = foods.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true))).slice(0, 20);
  cache.set(q, out);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return out;
}

export async function getFoodByBarcode(barcode: string): Promise<Food | null> {
  const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`);
  const json = (await res.json()) as { status?: number; product?: OffProduct };
  return json.product ? toFood({ ...json.product, code: barcode }) : null;
}
