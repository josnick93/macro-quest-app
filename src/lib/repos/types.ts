import type { DayNote, DiaryEntry, Food, GameState, NewEntry, Profile, Recipe, SavedMeal, Settings, WeightLog } from "../types";
import type { Snapshot } from "./migrations";

/**
 * Alimentos conocidos: propios, y los de Open Food Facts que se han usado o corregido.
 * Recientes y frecuentes no se guardan: se derivan del diario (lib/foods.ts).
 */
export interface FoodRepository {
  list(): Promise<Food[]>;
  findByBarcode(barcode: string): Promise<Food | null>;
  /** Crear o editar (propio, o corrección local de un producto de OFF). */
  save(food: Food): Promise<void>;
  /** Guarda un alimento de OFF usado para el historial, sin pisar una versión local existente. */
  remember(food: Food): Promise<void>;
  remove(id: string): Promise<void>;
  /** Ids de favoritos (alimentos o "recipe:<id>"). */
  getFavorites(): Promise<string[]>;
  toggleFavorite(food: Food): Promise<boolean>;
}

export interface SavedMealRepository {
  list(): Promise<SavedMeal[]>;
  save(meal: SavedMeal): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface DiaryRepository {
  listByDate(date: string): Promise<DiaryEntry[]>;
  listRange(from: string, to: string): Promise<DiaryEntry[]>;
  add(entries: NewEntry[]): Promise<DiaryEntry[]>;
  /** Actualiza o restaura (deshacer) entradas completas. */
  put(entries: DiaryEntry[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  getNote(date: string): Promise<DayNote | null>;
  saveNote(date: string, text: string): Promise<void>;
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
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
}

export interface WeightRepository {
  list(): Promise<WeightLog[]>;
  /** Un segundo registro en la misma fecha sustituye al anterior. */
  save(log: WeightLog): Promise<void>;
  remove(date: string): Promise<void>;
}

export interface DataRepository {
  exportAll(): Promise<Snapshot>;
  /** Sustituye todos los datos por los del snapshot. */
  replaceAll(snapshot: Snapshot): Promise<void>;
}

export interface Repositories {
  foods: FoodRepository;
  diary: DiaryRepository;
  recipes: RecipeRepository;
  savedMeals: SavedMealRepository;
  profile: ProfileRepository;
  weights: WeightRepository;
  data: DataRepository;
}
