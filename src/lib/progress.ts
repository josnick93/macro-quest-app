import type { DiaryEntry, Macros, MealType, Targets, WeightLog } from "./types";
import { MEALS } from "./types";
import { addDaysISO, diffDays, weekdayIndex } from "./date";
import { weightSlope } from "./goals";
import { emptyMacros, entryMacros, sumMacros, totalsFor } from "./nutrition";
import { KCAL_TOLERANCE } from "./xp";

// ---------- peso ----------

export interface WeightPoint {
  date: string;
  kg: number;
  /** Media de los pesajes de los 7 días que terminan en este: quita el ruido del día a día. */
  avg: number;
}

export const AVG_WINDOW_DAYS = 7;

export function weightSeries(weights: WeightLog[], windowDays = AVG_WINDOW_DAYS): WeightPoint[] {
  const ws = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return ws.map((w, i) => {
    const from = addDaysISO(w.date, -(windowDays - 1));
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && ws[j]!.date >= from; j--) {
      sum += ws[j]!.kg;
      n++;
    }
    return { date: w.date, kg: w.kg, avg: Math.round((sum / n) * 100) / 100 };
  });
}

/** Ventana y mínimos para dar un ritmo fiable. */
export const TREND_DAYS = 28;
export const TREND_MIN_WEIGHINS = 3;
export const TREND_MIN_SPAN = 7;

/** Ritmo real en kg/semana con los pesajes de las últimas 4 semanas; null si aún son pocos. */
export function weightTrend(weights: WeightLog[], today: string): number | null {
  const from = addDaysISO(today, -TREND_DAYS);
  const { slope, spanDays, count } = weightSlope(weights.filter((w) => w.date >= from && w.date <= today));
  if (count < TREND_MIN_WEIGHINS || spanDays < TREND_MIN_SPAN) return null;
  return Math.round(slope * 7 * 100) / 100;
}

/** Margen en kg dentro del cual se considera alcanzado el peso objetivo. */
export const AT_TARGET_KG = 0.2;
const MAX_PROJECTION_WEEKS = 104;

export type Projection = { kind: "reached" } | { kind: "away" } | { kind: "date"; date: string; weeks: number };

/**
 * Cuándo se llega al peso objetivo si sigue el ritmo real.
 * `away`: el peso no se mueve hacia el objetivo (o lo hace tan despacio que no tiene sentido dar fecha).
 */
export function projectTarget(currentKg: number, targetKg: number, kgPerWeek: number, today: string): Projection {
  const diff = targetKg - currentKg;
  if (Math.abs(diff) <= AT_TARGET_KG) return { kind: "reached" };
  if (kgPerWeek === 0 || Math.sign(diff) !== Math.sign(kgPerWeek)) return { kind: "away" };
  const weeks = diff / kgPerWeek;
  if (weeks > MAX_PROJECTION_WEEKS) return { kind: "away" };
  return { kind: "date", date: addDaysISO(today, Math.round(weeks * 7)), weeks: Math.round(weeks * 10) / 10 };
}

// ---------- días ----------

/** none: sin registro · under: registrado por debajo del margen · met: dentro del ±10 % · over: por encima. */
export type DayStatus = "none" | "under" | "met" | "over";

export interface DayStat extends Macros {
  date: string;
  target: Targets;
  status: DayStatus;
}

export function dayStatus(kcal: number, targetKcal: number): DayStatus {
  if (!(kcal > 0)) return "none";
  if (kcal > targetKcal * (1 + KCAL_TOLERANCE)) return "over";
  return kcal >= targetKcal * (1 - KCAL_TOLERANCE) ? "met" : "under";
}

/** Un resumen por día de `from` a `to` (ambos incluidos), haya registro o no. */
export function dayStats(entries: DiaryEntry[], from: string, to: string, targetsFor: (date: string) => Targets): DayStat[] {
  const byDate = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    const list = byDate.get(e.date);
    if (list) list.push(e);
    else byDate.set(e.date, [e]);
  }
  const out: DayStat[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    const totals = totalsFor(byDate.get(d) ?? []);
    const target = targetsFor(d);
    out.push({ date: d, ...totals, target, status: dayStatus(totals.kcal, target.kcal) });
  }
  return out;
}

// ---------- informe ----------

export interface MealShare {
  meal: MealType;
  label: string;
  kcal: number;
  /** % de las kcal del periodo. */
  pct: number;
}

export interface TopFood {
  name: string;
  /** Veces registrado. */
  times: number;
  kcal: number;
}

export interface Report {
  days: number;
  /** Días con algo registrado. Las medias se calculan solo con ellos. */
  logged: number;
  met: number;
  over: number;
  /** Media diaria de lo comido y de lo que tocaba esos mismos días. */
  avg: Macros;
  avgTarget: Macros;
  meals: MealShare[];
  top: TopFood[];
}

export const TOP_FOODS = 5;

const mean = (list: Macros[]): Macros => {
  const total = sumMacros(list);
  const n = list.length || 1;
  return { kcal: Math.round(total.kcal / n), protein: Math.round(total.protein / n), carbs: Math.round(total.carbs / n), fat: Math.round(total.fat / n) };
};

export function report(entries: DiaryEntry[], stats: DayStat[]): Report {
  const loggedDays = stats.filter((s) => s.status !== "none");
  const dates = new Set(stats.map((s) => s.date));
  const inRange = entries.filter((e) => dates.has(e.date));

  const totalKcal = inRange.reduce((a, e) => a + entryMacros(e).kcal, 0);
  const meals = MEALS.map(({ id, label }) => {
    const kcal = inRange.filter((e) => e.meal === id).reduce((a, e) => a + entryMacros(e).kcal, 0);
    return { meal: id, label, kcal: Math.round(kcal), pct: totalKcal > 0 ? Math.round((kcal / totalKcal) * 100) : 0 };
  }).filter((m) => m.kcal > 0);

  // El mismo alimento puede venir con distinto id (propio, de OFF, receta): se agrupa por lo que lo identifica.
  const foods = new Map<string, TopFood>();
  for (const e of inRange) {
    if (e.kind === "quick") continue;
    const key = e.foodId ?? e.recipeId ?? `name:${e.name.toLowerCase()}`;
    const item = foods.get(key) ?? { name: e.name, times: 0, kcal: 0 };
    item.times++;
    item.kcal += entryMacros(e).kcal;
    foods.set(key, item);
  }
  const top = [...foods.values()]
    .sort((a, b) => b.times - a.times || b.kcal - a.kcal || a.name.localeCompare(b.name, "es"))
    .slice(0, TOP_FOODS)
    .map((f) => ({ ...f, kcal: Math.round(f.kcal) }));

  return {
    days: stats.length,
    logged: loggedDays.length,
    met: loggedDays.filter((s) => s.status === "met").length,
    over: loggedDays.filter((s) => s.status === "over").length,
    avg: loggedDays.length ? mean(loggedDays) : emptyMacros(),
    avgTarget: loggedDays.length ? mean(loggedDays.map((s) => s.target)) : emptyMacros(),
    meals,
    top,
  };
}

// ---------- calendario ----------

/** "2026-10" del día dado. */
export const monthOf = (iso: string) => iso.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y = 1970, m = 1] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export const monthStart = (month: string) => `${month}-01`;
export const monthEnd = (month: string) => addDaysISO(monthStart(addMonths(month, 1)), -1);

/** Días del mes en una rejilla de semanas que empiezan en lunes; null en los huecos de antes del día 1. */
export function monthGrid(month: string): (string | null)[] {
  const first = monthStart(month);
  const days = diffDays(first, monthEnd(month)) + 1;
  return [...Array<null>(weekdayIndex(first)).fill(null), ...Array.from({ length: days }, (_, i) => addDaysISO(first, i))];
}

export const formatMonth = (month: string) => {
  const [y = 1970, m = 1] = month.split("-").map(Number);
  const text = new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
};
