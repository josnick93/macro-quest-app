import type { DiaryEntry, Goal, Profile, Targets, WeightLog } from "./types";
import { calcBMR, calcTargets, KCAL_PER_KG, totalsFor } from "./nutrition";
import { diffDays } from "./date";

export const GOAL_LABELS: Record<Goal, string> = { perder: "Definición", mantener: "Mantenimiento", ganar: "Volumen" };

/** Ritmo recomendado: 0,5 % del peso por semana en definición y 0,25 % en volumen (múltiplos de 0,05 kg). */
export function defaultRate(goal: Goal, weightKg: number): number {
  const pct = goal === "perder" ? 0.5 : goal === "ganar" ? 0.25 : 0;
  return Math.max(pct ? 0.05 : 0, (Math.round((weightKg * pct) / 5) * 5) / 100);
}

export interface Scenario {
  goal: Goal;
  rateKgWeek: number;
  targets: Targets;
  active: boolean;
}

/** Definición, mantenimiento y volumen con los datos del perfil; el activo usa el ritmo elegido. */
export function scenarios(p: Profile): Scenario[] {
  return (["perder", "mantener", "ganar"] as const).map((goal) => {
    const active = goal === p.goal;
    const rateKgWeek = goal === "mantener" ? 0 : active ? p.rateKgWeek : defaultRate(goal, p.weightKg);
    return { goal, rateKgWeek, active, targets: calcTargets({ ...p, goal, rateKgWeek }) };
  });
}

/** Avisos de salud sobre el plan. Son informativos: nunca bloquean. */
export function targetWarnings(p: Profile): string[] {
  const t = calcTargets(p);
  const out: string[] = [];
  const floor = p.sex === "hombre" ? 1500 : 1200;
  if (t.kcal < floor) out.push(`Menos de ${floor} kcal al día no es recomendable sin supervisión profesional.`);
  else if (t.kcal < Math.round(calcBMR(p))) out.push("El objetivo queda por debajo de tu metabolismo basal.");

  if (p.goal === "perder" && p.age < 18) out.push("Con menos de 18 años no conviene comer en déficit sin supervisión profesional.");

  const pctWeek = p.weightKg > 0 ? (p.rateKgWeek / p.weightKg) * 100 : 0;
  if (p.goal === "perder" && pctWeek > 1) out.push("Ritmo alto: perder más del 1 % del peso por semana suele costar músculo.");
  if (p.goal === "ganar" && pctWeek > 0.5) out.push("Ritmo alto: por encima del 0,5 % por semana se gana sobre todo grasa.");
  if (t.kcal > 0 && t.carbs === 0) out.push("Proteína y grasa ya cubren todas las calorías: no quedan carbohidratos.");

  const target = p.targetWeightKg;
  if (target) {
    if (p.goal === "perder" && target >= p.weightKg) out.push("El peso objetivo no está por debajo del actual: revisa el objetivo.");
    if (p.goal === "ganar" && target <= p.weightKg) out.push("El peso objetivo no está por encima del actual: revisa el objetivo.");
    if (p.heightCm > 0 && target / (p.heightCm / 100) ** 2 < 18.5) out.push("El peso objetivo queda por debajo de un IMC de 18,5.");
  }
  return out;
}

/** Semanas hasta el peso objetivo al ritmo actual; null si no aplica. */
export function weeksToTarget(p: Profile): number | null {
  const target = p.targetWeightKg;
  if (!target || p.goal === "mantener" || !(p.rateKgWeek > 0)) return null;
  const diff = p.goal === "perder" ? p.weightKg - target : target - p.weightKg;
  return diff > 0 ? diff / p.rateKgWeek : null;
}

// ---------- gasto real (TDEE adaptativo) ----------

export const TDEE_WINDOW_DAYS = 28;
export const TDEE_MIN_DAYS = 14;
export const TDEE_MIN_WEIGHINS = 4;
export const TDEE_MIN_SPAN = 14;

export interface TdeeEstimate {
  /** Días con registro completo dentro de la ventana. */
  days: number;
  weighIns: number;
  /** Días entre el primer y el último pesaje. */
  spanDays: number;
  avgKcal: number;
  kgPerWeek: number;
  /** null si todavía no hay datos suficientes. */
  tdee: number | null;
}

export function kcalByDay(entries: DiaryEntry[]): Record<string, number> {
  const groups: Record<string, DiaryEntry[]> = {};
  for (const e of entries) (groups[e.date] ??= []).push(e);
  return Object.fromEntries(Object.entries(groups).map(([d, list]) => [d, totalsFor(list).kcal]));
}

/**
 * Tendencia del peso: pendiente (kg/día) de la regresión lineal de los pesajes, así un pesaje suelto no la descoloca.
 * `spanDays` son los días entre el primero y el último.
 */
export function weightSlope(weights: WeightLog[]): { slope: number; spanDays: number; count: number } {
  const ws = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const first = ws[0];
  const xs = first ? ws.map((w) => diffDays(first.date, w.date)) : [];
  const spanDays = xs.length ? xs[xs.length - 1]! : 0;
  let slope = 0;
  if (ws.length >= 2 && spanDays > 0) {
    const mx = xs.reduce((a, x) => a + x, 0) / xs.length;
    const my = ws.reduce((a, w) => a + w.kg, 0) / ws.length;
    const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    slope = den > 0 ? ws.reduce((a, w, i) => a + (xs[i]! - mx) * (w.kg - my), 0) / den : 0;
  }
  return { slope, spanDays, count: ws.length };
}

/**
 * Gasto real = lo que comes de media − lo que cambia tu peso (tendencia × 7700 kcal/kg).
 * Los días con muy poco registrado (menos del 60 % de la mediana) se ignoran por incompletos.
 */
export function estimateTdee(kcal: Record<string, number>, weights: WeightLog[]): TdeeEstimate {
  const logged = Object.values(kcal).filter((k) => k > 0).sort((a, b) => a - b);
  const median = logged.length ? logged[Math.floor(logged.length / 2)]! : 0;
  const complete = logged.filter((k) => k >= median * 0.6);
  const avgKcal = complete.length ? complete.reduce((a, k) => a + k, 0) / complete.length : 0;

  const { slope, spanDays, count } = weightSlope(weights);

  const enough = complete.length >= TDEE_MIN_DAYS && count >= TDEE_MIN_WEIGHINS && spanDays >= TDEE_MIN_SPAN;
  const raw = avgKcal - slope * KCAL_PER_KG;
  return {
    days: complete.length,
    weighIns: count,
    spanDays,
    avgKcal: Math.round(avgKcal),
    kgPerWeek: Math.round(slope * 7 * 100) / 100,
    tdee: enough && raw >= 800 && raw <= 6000 ? Math.round(raw / 10) * 10 : null,
  };
}
