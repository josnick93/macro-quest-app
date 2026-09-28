import type { Food } from "./types";

/** Open Food Facts (licencia ODbL). Llamadas directas desde el navegador (OFF permite CORS). */
const BASE = "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,product_name_es,brands,nutriments";

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
};

function toFood(p: OffProduct): Food | null {
  const name = (p.product_name_es || p.product_name || "").trim();
  if (!name) return null;
  const n = p.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]) || Math.round(num(n["energy_100g"]) / 4.184);
  const per100g = {
    kcal,
    protein: num(n["proteins_100g"]),
    carbs: num(n["carbohydrates_100g"]),
    fat: num(n["fat_100g"]),
  };
  if (!per100g.kcal && !per100g.protein && !per100g.carbs && !per100g.fat) return null;
  return {
    id: p.code ? `off:${p.code}` : `off:${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    brand: p.brands?.split(",")[0]?.trim() || undefined,
    barcode: p.code,
    per100g,
  };
}

export async function searchFoods(query: string, signal?: AbortSignal): Promise<Food[]> {
  if (query.trim().length < 2) return [];
  const url =
    `${BASE}/cgi/search.pl?` +
    new URLSearchParams({
      search_terms: query,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "25",
      countries_tags_en: "spain",
      fields: FIELDS,
    }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`);
  const json = (await res.json()) as { products?: OffProduct[] };
  const foods = (json.products ?? []).map(toFood).filter((f): f is Food => f !== null);
  const seen = new Set<string>();
  return foods.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true))).slice(0, 20);
}

export async function getFoodByBarcode(barcode: string): Promise<Food | null> {
  const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { status?: number; product?: OffProduct };
  return json.product ? toFood({ code: barcode, ...json.product }) : null;
}
