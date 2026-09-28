import type { DiaryEntry, Food, GameState, Profile, Recipe, WeightLog } from "../types";

export interface FoodRepository {
  getRecents(): Promise<Food[]>;
  addRecent(food: Food): Promise<void>;
  getFavorites(): Promise<Food[]>;
  toggleFavorite(food: Food): Promise<boolean>;
  listCustom(): Promise<Food[]>;
  saveCustom(food: Food): Promise<void>;
  removeCustom(id: string): Promise<void>;
}

export interface DiaryRepository {
  listByDate(date: string): Promise<DiaryEntry[]>;
  listRange(from: string, to: string): Promise<DiaryEntry[]>;
  add(entry: Omit<DiaryEntry, "id">): Promise<DiaryEntry>;
  update(entry: DiaryEntry): Promise<void>;
  remove(id: string): Promise<void>;
  /** Copia las comidas de `from` a `to`, añadiéndolas a lo ya registrado. */
  copyDay(from: string, to: string): Promise<number>;
}

export interface RecipeRepository {
  list(): Promise<Recipe[]>;
  get(id: string): Promise<Recipe | null>;
  save(recipe: Recipe): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface ProfileRepository {
  getProfile(): Promise<Profile>;
  saveProfile(profile: Profile): Promise<void>;
  getGame(): Promise<GameState>;
  saveGame(state: GameState): Promise<void>;
}

export interface WeightRepository {
  list(): Promise<WeightLog[]>;
  /** Un segundo registro en la misma fecha sustituye al anterior. */
  save(log: WeightLog): Promise<void>;
  remove(date: string): Promise<void>;
}

export interface Repositories {
  foods: FoodRepository;
  diary: DiaryRepository;
  recipes: RecipeRepository;
  profile: ProfileRepository;
  weights: WeightRepository;
}
