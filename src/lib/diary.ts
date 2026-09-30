import type { DiaryEntry, Macros, MealType, NewEntry } from "./types";

export const QUICK_ADD_NAME = "Añadido rápido";

/** Convierte entradas existentes en nuevas para otro día (y opcionalmente otra comida). */
export function copyEntries(entries: DiaryEntry[], date: string, meal?: MealType): NewEntry[] {
  return entries.map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => ({ ...rest, date, meal: meal ?? rest.meal }));
}

/** kcal a partir de macros (4/4/9). */
export const kcalFromMacros = (m: Pick<Macros, "protein" | "carbs" | "fat">) => m.protein * 4 + m.carbs * 4 + m.fat * 9;

/**
 * Entrada de "añadido rápido": se guarda como 100 g con per100g = macros totales,
 * así el resto de cálculos (entryMacros, totales) funciona igual.
 * Si no se indican kcal, se calculan a partir de los macros.
 */
export function quickEntry(date: string, meal: MealType, m: Partial<Macros>, name?: string): NewEntry {
  const protein = m.protein ?? 0;
  const carbs = m.carbs ?? 0;
  const fat = m.fat ?? 0;
  const kcal = m.kcal && m.kcal > 0 ? m.kcal : kcalFromMacros({ protein, carbs, fat });
  return {
    date,
    meal,
    kind: "quick",
    name: name?.trim() || QUICK_ADD_NAME,
    grams: 100,
    per100g: { kcal, protein, carbs, fat },
  };
}
