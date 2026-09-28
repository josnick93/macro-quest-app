import type { DiaryEntry, Food, GameState, Profile, Recipe, WeightLog } from "../types";
import type {
  DiaryRepository,
  FoodRepository,
  ProfileRepository,
  RecipeRepository,
  Repositories,
  WeightRepository,
} from "./types";

const PREFIX = "sysnutri:";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* almacenamiento lleno o no disponible */
  }
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

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

export const DEFAULT_GAME: GameState = { xp: 0, streak: 0, awarded: [], history: [] };

class LocalFoodRepository implements FoodRepository {
  async getRecents() {
    return read<Food[]>("recents", []);
  }
  async addRecent(food: Food) {
    const list = read<Food[]>("recents", []).filter((f) => f.id !== food.id);
    write("recents", [food, ...list].slice(0, 30));
  }
  async getFavorites() {
    return read<Food[]>("favorites", []);
  }
  async toggleFavorite(food: Food) {
    const list = read<Food[]>("favorites", []);
    const exists = list.some((f) => f.id === food.id);
    write("favorites", exists ? list.filter((f) => f.id !== food.id) : [food, ...list]);
    return !exists;
  }
  async listCustom() {
    return read<Food[]>("custom", []);
  }
  async saveCustom(food: Food) {
    const list = read<Food[]>("custom", []).filter((f) => f.id !== food.id);
    write("custom", [{ ...food, custom: true }, ...list]);
    // Mantener coherentes recientes y favoritos
    for (const key of ["recents", "favorites"]) {
      write(
        key,
        read<Food[]>(key, []).map((f) => (f.id === food.id ? { ...food, custom: true } : f)),
      );
    }
  }
  async removeCustom(id: string) {
    for (const key of ["custom", "recents", "favorites"]) {
      write(
        key,
        read<Food[]>(key, []).filter((f) => f.id !== id),
      );
    }
  }
}

class LocalDiaryRepository implements DiaryRepository {
  private all() {
    return read<DiaryEntry[]>("diary", []);
  }
  async listByDate(date: string) {
    return this.all().filter((e) => e.date === date);
  }
  async listRange(from: string, to: string) {
    return this.all().filter((e) => e.date >= from && e.date <= to);
  }
  async add(entry: Omit<DiaryEntry, "id">) {
    const full: DiaryEntry = { ...entry, id: uid() };
    write("diary", [...this.all(), full]);
    return full;
  }
  async update(entry: DiaryEntry) {
    write(
      "diary",
      this.all().map((e) => (e.id === entry.id ? entry : e)),
    );
  }
  async remove(id: string) {
    write(
      "diary",
      this.all().filter((e) => e.id !== id),
    );
  }
  async copyDay(from: string, to: string) {
    const source = this.all().filter((e) => e.date === from);
    if (source.length === 0) return 0;
    const copies = source.map((e) => ({ ...e, id: uid(), date: to }));
    write("diary", [...this.all(), ...copies]);
    return copies.length;
  }
}

class LocalRecipeRepository implements RecipeRepository {
  async list() {
    return read<Recipe[]>("recipes", []);
  }
  async get(id: string) {
    return (await this.list()).find((r) => r.id === id) ?? null;
  }
  async save(recipe: Recipe) {
    const list = await this.list();
    const idx = list.findIndex((r) => r.id === recipe.id);
    if (idx >= 0) list[idx] = recipe;
    else list.unshift(recipe);
    write("recipes", list);
  }
  async remove(id: string) {
    write(
      "recipes",
      (await this.list()).filter((r) => r.id !== id),
    );
  }
}

class LocalProfileRepository implements ProfileRepository {
  async getProfile() {
    return { ...DEFAULT_PROFILE, ...read<Partial<Profile>>("profile", {}) };
  }
  async saveProfile(profile: Profile) {
    write("profile", profile);
  }
  async getGame() {
    return { ...DEFAULT_GAME, ...read<Partial<GameState>>("game", {}) };
  }
  async saveGame(state: GameState) {
    write("game", state);
  }
}

class LocalWeightRepository implements WeightRepository {
  async list() {
    return read<WeightLog[]>("weights", []).sort((a, b) => a.date.localeCompare(b.date));
  }
  async save(log: WeightLog) {
    const list = read<WeightLog[]>("weights", []).filter((w) => w.date !== log.date);
    write("weights", [...list, log].sort((a, b) => a.date.localeCompare(b.date)));
  }
  async remove(date: string) {
    write(
      "weights",
      read<WeightLog[]>("weights", []).filter((w) => w.date !== date),
    );
  }
}

export const createLocalRepositories = (): Repositories => ({
  foods: new LocalFoodRepository(),
  diary: new LocalDiaryRepository(),
  recipes: new LocalRecipeRepository(),
  profile: new LocalProfileRepository(),
  weights: new LocalWeightRepository(),
});
