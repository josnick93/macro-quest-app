import {
  isMealType,
  type DayNote,
  type DiaryEntry,
  type Food,
  type GameState,
  type Macros,
  type Profile,
  type Recipe,
  type Settings,
  type WeightLog,
} from "../types";

/**
 * Versión del esquema de datos. Si cambia la forma de algo guardado:
 * sube este número y añade un paso en MIGRATIONS. Nunca se pierden datos.
 */
export const SCHEMA_VERSION = 1;

export const LEGACY_PREFIX = "sysnutri:";

export const DEFAULT_PROFILE: Profile = {
  sex: "hombre",
  age: 33,
  heightCm: 178,
  weightKg: 80,
  activity: "moderado",
  goal: "perder",
  adjustPct: 15,
  proteinPerKg: 2,
  fatPct: 25,
};

export const DEFAULT_GAME: GameState = { xp: 0, activeDays: [], awarded: [], history: [] };
export const DEFAULT_SETTINGS: Settings = { hiddenMeals: [] };

/** Todos los datos del usuario. Es también el formato de exportación. */
export interface Snapshot {
  diary: DiaryEntry[];
  notes: DayNote[];
  foods: Food[];
  recipes: Recipe[];
  weights: WeightLog[];
  recents: Food[];
  favorites: Food[];
  profile: Profile;
  game: GameState;
  settings: Settings;
}

export interface ExportFile {
  app: "macro-quest";
  schema: number;
  exportedAt: string;
  data: Snapshot;
}

export const emptySnapshot = (): Snapshot => ({
  diary: [],
  notes: [],
  foods: [],
  recipes: [],
  weights: [],
  recents: [],
  favorites: [],
  profile: { ...DEFAULT_PROFILE },
  game: { ...DEFAULT_GAME },
  settings: { ...DEFAULT_SETTINGS },
});

// ---------- validación defensiva ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isISODate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const finite = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function macros(v: unknown): Macros | null {
  if (!isObj(v)) return null;
  return { kcal: finite(v.kcal), protein: finite(v.protein), carbs: finite(v.carbs), fat: finite(v.fat) };
}

function food(v: unknown, now: string): Food | null {
  if (!isObj(v) || !str(v.id) || !str(v.name)) return null;
  const per100g = macros(v.per100g);
  if (!per100g) return null;
  return {
    id: v.id,
    name: v.name,
    brand: str(v.brand) ? v.brand : undefined,
    barcode: str(v.barcode) ? v.barcode : undefined,
    per100g,
    ...(v.custom === true ? { custom: true } : {}),
    updatedAt: str(v.updatedAt) ? v.updatedAt : now,
  };
}

function entry(v: unknown, now: string): DiaryEntry | null {
  if (!isObj(v) || !str(v.id) || !isISODate(v.date) || !str(v.name)) return null;
  const per100g = macros(v.per100g);
  const grams = finite(v.grams, -1);
  if (!per100g || grams <= 0) return null;
  const recipeId = str(v.recipeId) ? v.recipeId : undefined;
  const kind = v.kind === "food" || v.kind === "recipe" || v.kind === "quick" ? v.kind : recipeId ? "recipe" : "food";
  return {
    id: v.id,
    date: v.date,
    meal: isMealType(v.meal) ? v.meal : "snacks",
    kind,
    name: v.name,
    brand: str(v.brand) ? v.brand : undefined,
    grams,
    per100g,
    foodId: str(v.foodId) ? v.foodId : undefined,
    recipeId,
    // Vacío = se rellena en normalizeSnapshot respetando el orden original.
    createdAt: str(v.createdAt) ? v.createdAt : "",
    updatedAt: str(v.updatedAt) ? v.updatedAt : now,
  };
}

function recipe(v: unknown, now: string): Recipe | null {
  if (!isObj(v) || !str(v.id) || !str(v.name)) return null;
  const ingredients = arr(v.ingredients).flatMap((i) => {
    if (!isObj(i) || !str(i.name)) return [];
    const per100g = macros(i.per100g);
    return per100g ? [{ id: str(i.id) ? i.id : `${v.id}:${i.name}`, name: i.name, grams: finite(i.grams), per100g }] : [];
  });
  const createdAt = str(v.createdAt) ? v.createdAt : now;
  return {
    id: v.id,
    name: v.name,
    ingredients,
    cookedWeight: finite(v.cookedWeight),
    createdAt,
    updatedAt: str(v.updatedAt) ? v.updatedAt : createdAt,
  };
}

function weight(v: unknown, now: string): WeightLog | null {
  if (!isObj(v) || !isISODate(v.date)) return null;
  const kg = finite(v.kg, -1);
  if (kg <= 0) return null;
  return { date: v.date, kg, updatedAt: str(v.updatedAt) ? v.updatedAt : now };
}

function note(v: unknown, now: string): DayNote | null {
  if (!isObj(v) || !isISODate(v.date) || typeof v.text !== "string") return null;
  return { date: v.date, text: v.text, updatedAt: str(v.updatedAt) ? v.updatedAt : now };
}

function profile(v: unknown): Profile {
  if (!isObj(v)) return { ...DEFAULT_PROFILE };
  const d = DEFAULT_PROFILE;
  return {
    sex: v.sex === "mujer" ? "mujer" : v.sex === "hombre" ? "hombre" : d.sex,
    age: finite(v.age, d.age),
    heightCm: finite(v.heightCm, d.heightCm),
    weightKg: finite(v.weightKg, d.weightKg),
    activity: (["sedentario", "ligero", "moderado", "alto", "muy_alto"] as const).find((a) => a === v.activity) ?? d.activity,
    goal: (["perder", "mantener", "ganar"] as const).find((g) => g === v.goal) ?? d.goal,
    adjustPct: finite(v.adjustPct, d.adjustPct),
    proteinPerKg: finite(v.proteinPerKg, d.proteinPerKg),
    fatPct: finite(v.fatPct, d.fatPct),
  };
}

function settings(v: unknown): Settings {
  if (!isObj(v)) return { ...DEFAULT_SETTINGS };
  return { hiddenMeals: arr(v.hiddenMeals).filter(isMealType) };
}

function game(v: unknown, diary: DiaryEntry[]): GameState {
  const g = isObj(v) ? v : {};
  const history = arr(g.history).flatMap((h) =>
    isObj(h) && isISODate(h.date) ? [{ date: h.date, xp: finite(h.xp), level: finite(h.level, 1) }] : [],
  );
  // Los días activos se reconstruyen a partir del diario real (y del estado antiguo por si acaso).
  const days = new Set<string>(arr(g.activeDays).filter(isISODate));
  for (const e of diary) days.add(e.date);
  for (const h of history) days.add(h.date);
  if (isISODate(g.lastActiveDate)) days.add(g.lastActiveDate);
  return {
    xp: Math.max(0, finite(g.xp)),
    activeDays: [...days].sort(),
    awarded: arr(g.awarded).filter(str),
    history,
  };
}

const list = <T>(v: unknown, fn: (x: unknown, now: string) => T | null, now: string): T[] =>
  arr(v).flatMap((x) => {
    const r = fn(x, now);
    return r ? [r] : [];
  });

/** Normaliza datos de cualquier procedencia al esquema actual, descartando solo registros corruptos. */
export function normalizeSnapshot(raw: Obj, now = new Date().toISOString()): Snapshot {
  const base = Date.parse(now) || 0;
  const diary = list(raw.diary, entry, now).map((e, i) =>
    e.createdAt ? e : { ...e, createdAt: new Date(base - 1_000_000 + i).toISOString() },
  );
  const custom = list(raw.foods, food, now).map((f) => ({ ...f, custom: true }));
  return {
    diary,
    notes: list(raw.notes, note, now),
    foods: custom,
    recipes: list(raw.recipes, recipe, now),
    weights: list(raw.weights, weight, now),
    recents: list(raw.recents, food, now),
    favorites: list(raw.favorites, food, now),
    profile: profile(raw.profile),
    game: game(raw.game, diary),
    settings: settings(raw.settings),
  };
}

/**
 * Datos de la versión en localStorage (claves "sysnutri:*") → esquema actual.
 * `get` devuelve el valor ya parseado de una clave sin prefijo, o undefined.
 */
export function fromLegacy(get: (key: string) => unknown, now = new Date().toISOString()): Snapshot {
  return normalizeSnapshot(
    {
      diary: get("diary"),
      foods: get("custom"),
      recipes: get("recipes"),
      weights: get("weights"),
      recents: get("recents"),
      favorites: get("favorites"),
      profile: get("profile"),
      game: get("game"),
    },
    now,
  );
}

/** Pasos de migración entre versiones del formato de exportación. Índice = versión de origen. */
const MIGRATIONS: Record<number, (d: Obj) => Obj> = {
  // 1: (d) => ({ ...d, ... })   ← ejemplo para la futura v2
};

export class ImportError extends Error {}

/** Acepta una exportación nueva ({app, schema, data}) o una antigua (claves "sysnutri:*"). */
export function parseImport(json: unknown, now = new Date().toISOString()): Snapshot {
  if (!isObj(json)) throw new ImportError("El archivo no contiene un objeto JSON");

  if (json.app === "macro-quest") {
    let schema = finite(json.schema, 0);
    if (schema > SCHEMA_VERSION) throw new ImportError("El archivo es de una versión más nueva de la app");
    if (!isObj(json.data)) throw new ImportError("Falta el bloque de datos");
    let data = json.data;
    while (schema < SCHEMA_VERSION) {
      const step = MIGRATIONS[schema];
      if (step) data = step(data);
      schema++;
    }
    return normalizeSnapshot(data, now);
  }

  const legacyKeys = Object.keys(json).filter((k) => k.startsWith(LEGACY_PREFIX));
  if (legacyKeys.length === 0) throw new ImportError("No es una copia de Macro Quest");
  return fromLegacy((k) => json[LEGACY_PREFIX + k], now);
}
