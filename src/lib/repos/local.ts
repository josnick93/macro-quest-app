import type { DayNote, DiaryEntry, Food, GameState, NewEntry, Profile, Recipe, SavedMeal, Settings, WeightLog } from "../types";
import type {
  DataRepository,
  DiaryRepository,
  FoodRepository,
  ProfileRepository,
  RecipeRepository,
  Repositories,
  SavedMealRepository,
  WeightRepository,
} from "./types";
import { DATA_STORES, req, run, tombstone, untombstone, writeSnapshot, type StoreName } from "./idb";
import { DEFAULT_GAME, DEFAULT_PROFILE, DEFAULT_SETTINGS, normalizeProfile, type Snapshot } from "./migrations";

export { DEFAULT_GAME, DEFAULT_PROFILE, DEFAULT_SETTINGS };

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const nowISO = () => new Date().toISOString();

const getAll = <T>(store: StoreName) => run([store], "readonly", (tx) => req(tx.objectStore(store).getAll() as IDBRequest<T[]>));

const getKv = <T>(key: string, fallback: T) =>
  run(["kv"], "readonly", async (tx) => ((await req(tx.objectStore("kv").get(key))) as T | undefined) ?? fallback);

const setKv = (key: string, value: unknown) => run(["kv"], "readwrite", (tx) => void tx.objectStore("kv").put(value, key));

const byCreatedAt = (a: DiaryEntry, b: DiaryEntry) => a.createdAt.localeCompare(b.createdAt);

class IdbFoodRepository implements FoodRepository {
  list() {
    return getAll<Food>("foods");
  }
  async findByBarcode(barcode: string) {
    const hits = await run(["foods"], "readonly", (tx) =>
      req(tx.objectStore("foods").index("barcode").getAll(barcode) as IDBRequest<Food[]>),
    );
    // Si hay varios (p. ej. OFF + propio con el mismo código), gana el último editado.
    return hits.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0] ?? null;
  }
  save(food: Food) {
    if (food.source === "recipe") return Promise.resolve();
    const saved: Food = { ...food, updatedAt: nowISO() };
    return run(["foods", "tombstones"], "readwrite", (tx) => {
      tx.objectStore("foods").put(saved);
      untombstone(tx, "foods", saved.id);
    });
  }
  remember(food: Food) {
    if (food.source === "recipe") return Promise.resolve();
    return run(["foods", "tombstones"], "readwrite", async (tx) => {
      const os = tx.objectStore("foods");
      const existing = (await req(os.get(food.id))) as Food | undefined;
      if (existing) return; // nunca pisar una versión local (propia o corregida)
      os.put({ ...food, updatedAt: nowISO() });
      untombstone(tx, "foods", food.id);
    });
  }
  remove(id: string) {
    return run(["foods", "kv", "tombstones"], "readwrite", async (tx) => {
      tx.objectStore("foods").delete(id);
      tombstone(tx, "foods", id, nowISO());
      const kv = tx.objectStore("kv");
      const favs = ((await req(kv.get("favorites"))) as string[] | undefined) ?? [];
      kv.put(favs.filter((f) => f !== id), "favorites");
    });
  }
  getFavorites() {
    return getKv<string[]>("favorites", []);
  }
  toggleFavorite(food: Food) {
    return run(["foods", "kv", "tombstones"], "readwrite", async (tx) => {
      const kv = tx.objectStore("kv");
      const list = ((await req(kv.get("favorites"))) as string[] | undefined) ?? [];
      const exists = list.includes(food.id);
      kv.put(exists ? list.filter((id) => id !== food.id) : [food.id, ...list], "favorites");
      if (!exists && food.source !== "recipe") {
        const os = tx.objectStore("foods");
        if (!(await req(os.get(food.id)))) {
          os.put({ ...food, updatedAt: nowISO() });
          untombstone(tx, "foods", food.id);
        }
      }
      return !exists;
    });
  }
}

class IdbSavedMealRepository implements SavedMealRepository {
  async list() {
    const list = await getAll<SavedMeal>("savedMeals");
    return list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
  save(meal: SavedMeal) {
    return run(["savedMeals", "tombstones"], "readwrite", (tx) => {
      tx.objectStore("savedMeals").put({ ...meal, updatedAt: nowISO() });
      untombstone(tx, "savedMeals", meal.id);
    });
  }
  remove(id: string) {
    return run(["savedMeals", "tombstones"], "readwrite", (tx) => {
      tx.objectStore("savedMeals").delete(id);
      tombstone(tx, "savedMeals", id, nowISO());
    });
  }
}

class IdbDiaryRepository implements DiaryRepository {
  async listByDate(date: string) {
    const list = await run(["diary"], "readonly", (tx) =>
      req(tx.objectStore("diary").index("date").getAll(date) as IDBRequest<DiaryEntry[]>),
    );
    return list.sort(byCreatedAt);
  }
  async listRange(from: string, to: string) {
    const list = await run(["diary"], "readonly", (tx) =>
      req(tx.objectStore("diary").index("date").getAll(IDBKeyRange.bound(from, to)) as IDBRequest<DiaryEntry[]>),
    );
    return list.sort((a, b) => a.date.localeCompare(b.date) || byCreatedAt(a, b));
  }
  add(entries: NewEntry[]) {
    const base = Date.now();
    const full: DiaryEntry[] = entries.map((e, i) => {
      // +i ms para conservar el orden al añadir varias de golpe
      const ts = new Date(base + i).toISOString();
      return { ...e, id: uid(), createdAt: ts, updatedAt: ts };
    });
    return run(["diary"], "readwrite", (tx) => {
      const os = tx.objectStore("diary");
      for (const e of full) os.put(e);
      return full;
    });
  }
  put(entries: DiaryEntry[]) {
    const now = nowISO();
    return run(["diary", "tombstones"], "readwrite", (tx) => {
      for (const e of entries) {
        tx.objectStore("diary").put({ ...e, updatedAt: now });
        untombstone(tx, "diary", e.id);
      }
    });
  }
  remove(ids: string[]) {
    const now = nowISO();
    return run(["diary", "tombstones"], "readwrite", (tx) => {
      for (const id of ids) {
        tx.objectStore("diary").delete(id);
        tombstone(tx, "diary", id, now);
      }
    });
  }
  async getNote(date: string) {
    return (await run(["notes"], "readonly", (tx) => req(tx.objectStore("notes").get(date) as IDBRequest<DayNote | undefined>))) ?? null;
  }
  saveNote(date: string, text: string) {
    const now = nowISO();
    return run(["notes", "tombstones"], "readwrite", (tx) => {
      if (text.trim()) {
        tx.objectStore("notes").put({ date, text, updatedAt: now } satisfies DayNote);
        untombstone(tx, "notes", date);
      } else {
        tx.objectStore("notes").delete(date);
        tombstone(tx, "notes", date, now);
      }
    });
  }
}

class IdbRecipeRepository implements RecipeRepository {
  async list() {
    const list = await getAll<Recipe>("recipes");
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async get(id: string) {
    return (await run(["recipes"], "readonly", (tx) => req(tx.objectStore("recipes").get(id) as IDBRequest<Recipe | undefined>))) ?? null;
  }
  save(recipe: Recipe) {
    return run(["recipes", "tombstones"], "readwrite", (tx) => {
      tx.objectStore("recipes").put({ ...recipe, updatedAt: nowISO() });
      untombstone(tx, "recipes", recipe.id);
    });
  }
  remove(id: string) {
    return run(["recipes", "tombstones"], "readwrite", (tx) => {
      tx.objectStore("recipes").delete(id);
      tombstone(tx, "recipes", id, nowISO());
    });
  }
}

class IdbProfileRepository implements ProfileRepository {
  async getProfile() {
    return normalizeProfile(await getKv<unknown>("profile", undefined));
  }
  saveProfile(profile: Profile) {
    return setKv("profile", profile);
  }
  async getGame() {
    return { ...DEFAULT_GAME, ...(await getKv<Partial<GameState>>("game", {})) };
  }
  saveGame(state: GameState) {
    return setKv("game", state);
  }
  async getSettings() {
    return { ...DEFAULT_SETTINGS, ...(await getKv<Partial<Settings>>("settings", {})) };
  }
  saveSettings(settings: Settings) {
    return setKv("settings", settings);
  }
}

class IdbWeightRepository implements WeightRepository {
  list() {
    return getAll<WeightLog>("weights"); // ordenado por fecha (clave primaria)
  }
  save(log: WeightLog) {
    return run(["weights", "tombstones"], "readwrite", (tx) => {
      tx.objectStore("weights").put({ ...log, updatedAt: nowISO() });
      untombstone(tx, "weights", log.date);
    });
  }
  remove(date: string) {
    return run(["weights", "tombstones"], "readwrite", (tx) => {
      tx.objectStore("weights").delete(date);
      tombstone(tx, "weights", date, nowISO());
    });
  }
}

class IdbDataRepository implements DataRepository {
  exportAll() {
    return run(DATA_STORES, "readonly", async (tx): Promise<Snapshot> => {
      const all = <T>(s: StoreName) => req(tx.objectStore(s).getAll() as IDBRequest<T[]>);
      const kv = <T>(k: string, fb: T) => req(tx.objectStore("kv").get(k)).then((v) => (v as T | undefined) ?? fb);
      const [diary, notes, foods, recipes, savedMeals, weights, favorites, profile, game, settings] = await Promise.all([
        all<DiaryEntry>("diary"),
        all<DayNote>("notes"),
        all<Food>("foods"),
        all<Recipe>("recipes"),
        all<SavedMeal>("savedMeals"),
        all<WeightLog>("weights"),
        kv<string[]>("favorites", []),
        kv<unknown>("profile", undefined),
        kv<Partial<GameState>>("game", {}),
        kv<Partial<Settings>>("settings", {}),
      ]);
      return {
        diary,
        notes,
        foods,
        recipes,
        savedMeals,
        weights,
        favorites,
        profile: normalizeProfile(profile),
        game: { ...DEFAULT_GAME, ...game },
        settings: { ...DEFAULT_SETTINGS, ...settings },
      };
    });
  }
  replaceAll(snapshot: Snapshot) {
    return run(DATA_STORES, "readwrite", (tx) => {
      for (const s of DATA_STORES) tx.objectStore(s).clear();
      writeSnapshot(tx, snapshot);
    });
  }
}

export const createLocalRepositories = (): Repositories => ({
  foods: new IdbFoodRepository(),
  diary: new IdbDiaryRepository(),
  recipes: new IdbRecipeRepository(),
  savedMeals: new IdbSavedMealRepository(),
  profile: new IdbProfileRepository(),
  weights: new IdbWeightRepository(),
  data: new IdbDataRepository(),
});
