import type { DiaryEntry, Food, Recipe, Serving } from "./types";
import { recipePer100g, recipeRawWeight } from "./nutrition";

export const RECIPE_PREFIX = "recipe:";
export const recipeFoodId = (recipeId: string) => RECIPE_PREFIX + recipeId;

export function recipeAsFood(r: Recipe): Food {
  const weight = r.cookedWeight > 0 ? r.cookedWeight : recipeRawWeight(r);
  const servings: Serving[] = [];
  if (r.servings && r.servings > 0 && weight > 0) servings.push({ label: "ración", grams: Math.round(weight / r.servings) });
  if (weight > 0) servings.push({ label: "receta entera", grams: Math.round(weight) });
  return { id: recipeFoodId(r.id), name: r.name, brand: "Mi receta", per100g: recipePer100g(r), servings, source: "recipe" };
}

/** Alimento reconstruido desde una entrada del diario (si ya no está en el almacén). */
export function foodFromEntry(e: DiaryEntry): Food {
  return {
    id: e.foodId ?? `entry:${e.id}`,
    name: e.name,
    brand: e.brand,
    per100g: e.per100g,
    source: e.kind === "recipe" ? "recipe" : e.foodId?.startsWith("custom:") ? "custom" : "off",
  };
}

export interface FoodStats {
  /** foodIds por uso más reciente. */
  recents: string[];
  /** foodIds por número de usos (desempate: más reciente). */
  frequent: string[];
  count: Record<string, number>;
  /** Últimos gramos usados de cada alimento. */
  lastGrams: Record<string, number>;
  /** Última entrada de cada alimento, para reconstruirlo si hace falta. */
  lastEntry: Record<string, DiaryEntry>;
}

/** Recientes, frecuentes y última cantidad, derivados del diario (sin datos duplicados que mantener). */
export function foodStats(entries: DiaryEntry[]): FoodStats {
  const sorted = [...entries]
    .filter((e) => e.kind !== "quick" && e.foodId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const count: Record<string, number> = {};
  const lastGrams: Record<string, number> = {};
  const lastEntry: Record<string, DiaryEntry> = {};
  const recents: string[] = [];
  for (const e of sorted) {
    const id = e.foodId!;
    count[id] = (count[id] ?? 0) + 1;
    if (!(id in lastEntry)) {
      lastEntry[id] = e;
      lastGrams[id] = e.grams;
      recents.push(id);
    }
  }
  const frequent = [...recents].sort((a, b) => count[b]! - count[a]!); // sort estable: desempata por reciente
  return { recents, frequent, count, lastGrams, lastEntry };
}

/** Resuelve ids a alimentos: almacén → recetas → última entrada del diario. */
export function resolveFoods(ids: string[], known: Map<string, Food>, lastEntry: Record<string, DiaryEntry> = {}): Food[] {
  return ids.flatMap((id) => {
    const f = known.get(id) ?? (lastEntry[id] ? foodFromEntry(lastEntry[id]) : undefined);
    return f ? [f] : [];
  });
}

export function knownFoods(foods: Food[], recipes: Recipe[]): Map<string, Food> {
  const map = new Map<string, Food>();
  for (const f of foods) map.set(f.id, f);
  for (const r of recipes) map.set(recipeFoodId(r.id), recipeAsFood(r));
  return map;
}

// ---------- cantidades ----------

export const GRAM_UNIT: Serving = { label: "g", grams: 1 };

export const unitsFor = (food: Pick<Food, "servings">): Serving[] => [GRAM_UNIT, ...(food.servings ?? [])];

export interface Quantity {
  unit: Serving;
  amount: number;
}

/** Una "ración" mayor que esto es un envase familiar (1 kg de arroz), no lo que se come de una vez. */
export const MAX_DEFAULT_SERVING_G = 600;

/** Cantidad inicial: la última usada; si no, la primera ración individual; si no, 100 g. */
export function defaultQuantity(food: Pick<Food, "servings">, lastGrams?: number): Quantity {
  const serving = food.servings?.find((s) => s.grams <= MAX_DEFAULT_SERVING_G);
  if (lastGrams && lastGrams > 0) {
    // Si la última cantidad coincide con un número entero de raciones, mostrarla así.
    for (const s of food.servings ?? []) {
      const n = lastGrams / s.grams;
      const whole = Math.round(n);
      if (whole >= 1 && whole <= 20 && Math.abs(n - whole) < 0.01) return { unit: s, amount: whole };
    }
    return { unit: GRAM_UNIT, amount: Math.round(lastGrams * 10) / 10 };
  }
  if (serving) return { unit: serving, amount: 1 };
  return { unit: GRAM_UNIT, amount: 100 };
}

export const sameUnit = (a: Serving, b: Serving) => a.label === b.label && a.grams === b.grams;

export const quantityGrams = (q: Quantity) => Math.round(q.amount * q.unit.grams * 10) / 10;

/** "150 g" o "2 × rebanada". */
export function formatQuantity(q: Quantity): string {
  return q.unit.label === "g" ? `${q.amount} g` : `${q.amount} × ${q.unit.label}`;
}

// ---------- búsqueda ----------

export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Todas las palabras de la búsqueda aparecen en nombre o marca (sin tildes ni mayúsculas). */
export function matchesQuery(food: Pick<Food, "name" | "brand">, query: string): boolean {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const hay = normalizeText(`${food.name} ${food.brand ?? ""}`);
  return words.every((w) => hay.includes(w));
}

export type SearchGroup = "mine" | "recipes" | "history" | "off";

export interface SearchResult {
  food: Food;
  group: SearchGroup;
}

/**
 * Búsqueda unificada: mis alimentos → recetas → historial → Open Food Facts.
 * Un resultado de OFF que ya está guardado en local (quizá corregido) se muestra con la versión local.
 */
export function mergeSearch(query: string, local: Food[], remote: Food[], usage: Record<string, number> = {}): SearchResult[] {
  const byUse = (a: Food, b: Food) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0);
  const hits = local.filter((f) => matchesQuery(f, query)).sort(byUse);
  const group = (f: Food): SearchGroup => (f.source === "custom" ? "mine" : f.source === "recipe" ? "recipes" : "history");
  const order: SearchGroup[] = ["mine", "recipes", "history"];
  const out: SearchResult[] = order.flatMap((g) => hits.filter((f) => group(f) === g).map((food) => ({ food, group: g })));
  const seen = new Set(out.map((r) => r.food.id));
  const localById = new Map(local.map((f) => [f.id, f]));
  for (const f of remote) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push({ food: localById.get(f.id) ?? f, group: "off" });
  }
  return out;
}
