import type { DayNote, DiaryEntry, Food, GameState, NewEntry, Profile, Recipe, Settings, WeightLog } from "../types";
import type { Snapshot } from "./migrations";

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
  profile: ProfileRepository;
  weights: WeightRepository;
  data: DataRepository;
}
