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

/** Macros + micronutrientes opcionales (g por 100 g; sal en g). */
export interface Nutrients extends Macros {
  fiber?: number | undefined;
  sugar?: number | undefined;
  satFat?: number | undefined;
  salt?: number | undefined;
}

export const MICROS: { key: "fiber" | "sugar" | "satFat" | "salt"; label: string }[] = [
  { key: "fiber", label: "Fibra" },
  { key: "sugar", label: "Azúcares" },
  { key: "satFat", label: "Grasa saturada" },
  { key: "salt", label: "Sal" },
];

/** Ración o unidad: "1 yogur" = 125 g. */
export interface Serving {
  label: string;
  grams: number;
}

/** off: Open Food Facts · custom: creado por el usuario · recipe: receta propia. */
export type FoodSource = "off" | "custom" | "recipe";

/** Alimento normalizado (valores por 100 g). */
export interface Food {
  id: string;
  name: string;
  brand?: string | undefined;
  barcode?: string | undefined;
  per100g: Nutrients;
  servings?: Serving[] | undefined;
  source: FoodSource;
  /** Datos de Open Food Facts corregidos a mano por el usuario. */
  edited?: boolean | undefined;
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
  /** Copia de los valores en el momento de registrar: editar el alimento no reescribe el pasado. */
  per100g: Nutrients;
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
  per100g: Nutrients;
  foodId?: string | undefined;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  /** Peso total una vez cocinada, en gramos. */
  cookedWeight: number;
  /** En cuántas raciones se divide (opcional). */
  servings?: number | undefined;
  createdAt: string;
  updatedAt?: string;
}

/** Plantilla de comida ("Mi desayuno habitual") que se registra de golpe. */
export type SavedMealItem = Omit<NewEntry, "date" | "meal">;

export interface SavedMeal {
  id: string;
  name: string;
  items: SavedMealItem[];
  createdAt: string;
  updatedAt: string;
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
  /** Ritmo de cambio de peso en kg/semana (magnitud; el signo lo da el objetivo). */
  rateKgWeek: number;
  proteinPerKg: number;
  fatPct: number;
  /** % de grasa corporal (a mano o estimado con las medidas). Si existe, el basal usa la masa magra. */
  bodyFatPct?: number | undefined;
  neckCm?: number | undefined;
  waistCm?: number | undefined;
  hipCm?: number | undefined;
  targetWeightKg?: number | undefined;
  /** Gasto diario medido con el diario y el peso; sustituye al de la fórmula. */
  tdeeOverride?: number | undefined;
  /** Ajuste de kcal por día de la semana (7 valores, lunes primero). */
  weekdayKcal?: number[] | undefined;
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
