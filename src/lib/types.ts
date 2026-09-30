export type MealType = "desayuno" | "almuerzo" | "comida" | "merienda" | "cena" | "snacks";

export const MEALS: { id: MealType; label: string }[] = [
  { id: "desayuno", label: "Desayuno" },
  { id: "almuerzo", label: "Almuerzo" },
  { id: "comida", label: "Comida" },
  { id: "merienda", label: "Merienda" },
  { id: "cena", label: "Cena" },
  { id: "snacks", label: "Snacks" },
];

export const isMealType = (v: unknown): v is MealType => MEALS.some((m) => m.id === v);

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Alimento normalizado (macros por 100 g). */
export interface Food {
  id: string;
  name: string;
  brand?: string | undefined;
  barcode?: string | undefined;
  per100g: Macros;
  custom?: boolean;
  updatedAt?: string;
}

/** food: alimento · recipe: receta · quick: solo kcal/macros (grams = 100 y per100g = total). */
export type EntryKind = "food" | "recipe" | "quick";

export interface DiaryEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  meal: MealType;
  kind: EntryKind;
  name: string;
  brand?: string | undefined;
  grams: number;
  /** Copia de los macros en el momento de registrar: editar el alimento no reescribe el pasado. */
  per100g: Macros;
  foodId?: string | undefined;
  recipeId?: string | undefined;
  /** ISO datetime; ordena las entradas dentro del día. */
  createdAt: string;
  /** ISO datetime */
  updatedAt: string;
}

export type NewEntry = Omit<DiaryEntry, "id" | "createdAt" | "updatedAt">;

export interface DayNote {
  date: string;
  text: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  grams: number;
  per100g: Macros;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  /** Peso total una vez cocinada, en gramos. */
  cookedWeight: number;
  createdAt: string;
  updatedAt?: string;
}

export interface WeightLog {
  /** YYYY-MM-DD */
  date: string;
  kg: number;
  updatedAt?: string;
}

export type Sex = "hombre" | "mujer";
export type Activity = "sedentario" | "ligero" | "moderado" | "alto" | "muy_alto";
export type Goal = "perder" | "mantener" | "ganar";

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  /** Porcentaje de déficit/superávit sobre el TDEE (0-30). */
  adjustPct: number;
  proteinPerKg: number;
  fatPct: number;
}

export interface Settings {
  /** Comidas ocultas en el diario (se muestran igualmente si tienen entradas). */
  hiddenMeals: MealType[];
}

export interface GameState {
  xp: number;
  /** Días (YYYY-MM-DD) con al menos una entrada. La racha se deriva de aquí. */
  activeDays: string[];
  awarded: string[];
  history: { date: string; xp: number; level: number }[];
}

export interface Targets {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}
