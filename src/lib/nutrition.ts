import type { Activity, DiaryEntry, Macros, Profile, Recipe, Targets } from "./types";

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  muy_alto: 1.9,
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentario: "Sedentario",
  ligero: "Ligero (1-3 días)",
  moderado: "Moderado (3-5 días)",
  alto: "Alto (6-7 días)",
  muy_alto: "Muy alto (2 sesiones/día)",
};

export const emptyMacros = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

export function scaleMacros(per100g: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: per100g.kcal * f,
    protein: per100g.protein * f,
    carbs: per100g.carbs * f,
    fat: per100g.fat * f,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    emptyMacros(),
  );
}

export const entryMacros = (e: DiaryEntry): Macros => scaleMacros(e.per100g, e.grams);
export const totalsFor = (entries: DiaryEntry[]): Macros => sumMacros(entries.map(entryMacros));

/** Mifflin-St Jeor */
export function calcBMR(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "hombre" ? base + 5 : base - 161;
}

export function calcTargets(p: Profile): Targets {
  const bmr = calcBMR(p);
  const tdee = bmr * ACTIVITY_FACTORS[p.activity];
  const sign = p.goal === "perder" ? -1 : p.goal === "ganar" ? 1 : 0;
  const kcal = tdee * (1 + (sign * p.adjustPct) / 100);
  const protein = p.proteinPerKg * p.weightKg;
  const fat = (kcal * (p.fatPct / 100)) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

export function recipeTotals(recipe: Pick<Recipe, "ingredients">): Macros {
  return sumMacros(recipe.ingredients.map((i) => scaleMacros(i.per100g, i.grams)));
}

export function recipeRawWeight(recipe: Pick<Recipe, "ingredients">): number {
  return recipe.ingredients.reduce((a, i) => a + i.grams, 0);
}

/** Macros por 100 g de receta cocinada (si no hay peso cocinado, se usa el crudo). */
export function recipePer100g(recipe: Pick<Recipe, "ingredients" | "cookedWeight">): Macros {
  const total = recipeTotals(recipe);
  const weight = recipe.cookedWeight > 0 ? recipe.cookedWeight : recipeRawWeight(recipe) || 1;
  return {
    kcal: (total.kcal / weight) * 100,
    protein: (total.protein / weight) * 100,
    carbs: (total.carbs / weight) * 100,
    fat: (total.fat / weight) * 100,
  };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
