import type { DayNote, DiaryEntry, Food, GameState, NewEntry, Profile, Recipe, SavedMeal, Settings, WeightLog } from "../types";
import type { Snapshot } from "./migrations";
import type { SessionUser } from "../auth";

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
  /** Entradas del diario en total. */
  count(): Promise<number>;
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
  /** false hasta que el usuario guarda su perfil por primera vez (mientras tanto se usa uno de ejemplo). */
  isProfileSet(): Promise<boolean>;
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

/** De qué cuenta son los datos de este dispositivo. */
export interface SyncOwner {
  userId: string;
  email: string;
  /** Ya se ha completado al menos una sincronización con el servidor. */
  synced: boolean;
}

export interface SyncResult {
  pushed: number;
  /** Cambios de otros dispositivos aplicados aquí. */
  pulled: number;
}

/** Copia en la nube: sube los cambios locales y aplica los de otros dispositivos. */
export interface SyncRepository {
  /** null si los datos de este dispositivo aún no son de ninguna cuenta. */
  owner(): Promise<SyncOwner | null>;
  /** Cambios locales pendientes de subir. */
  pending(): Promise<number>;
  run(user: SessionUser): Promise<SyncResult>;
  /** Tras borrar la cuenta: olvida la copia del servidor. Los datos locales se quedan. */
  forget(): Promise<void>;
  /** Borra todos los datos de este dispositivo (para usarlo con otra cuenta). */
  wipe(): Promise<void>;
}

export interface Repositories {
  foods: FoodRepository;
  diary: DiaryRepository;
  recipes: RecipeRepository;
  savedMeals: SavedMealRepository;
  profile: ProfileRepository;
  weights: WeightRepository;
  data: DataRepository;
  sync: SyncRepository;
}
