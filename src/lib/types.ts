export type MealType = "desayuno" | "comida" | "cena" | "snacks";

export const MEALS: { id: MealType; label: string }[] = [
  { id: "desayuno", label: "Desayuno" },
  { id: "comida", label: "Comida" },
  { id: "cena", label: "Cena" },
  { id: "snacks", label: "Snacks" },
];

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
}

export interface DiaryEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  meal: MealType;
  name: string;
  brand?: string | undefined;
  grams: number;
  per100g: Macros;
  foodId?: string | undefined;
  recipeId?: string | undefined;
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
}

export interface WeightLog {
  /** YYYY-MM-DD */
  date: string;
  kg: number;
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
  /** Porcentaje de déficit/superávit sobre el TDEE (0-40). */
  adjustPct: number;
  proteinPerKg: number;
  fatPct: number;
}

export interface GameState {
  xp: number;
  streak: number;
  lastActiveDate?: string | undefined;
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
