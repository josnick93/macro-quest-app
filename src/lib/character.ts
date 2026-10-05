import type { DiaryEntry, Targets, WeightLog } from "./types";
import { addDaysISO } from "./date";
import { weeklyQuests } from "./gamification";
import { dayStats, type DayStat } from "./progress";
import { shieldedStreak, weekStartISO } from "./xp";

/** Ficha de personaje: atributos derivados de los hábitos reales. Se calcula al vuelo y nunca baja. */

export type StatId = "fue" | "vit" | "dis" | "int";

export interface StatInfo {
  id: StatId;
  abbr: string;
  name: string;
  /** Qué suma puntos. */
  rule: string;
}

export const STATS: StatInfo[] = [
  { id: "fue", abbr: "FUE", name: "Fuerza", rule: "Días llegando a la proteína" },
  { id: "vit", abbr: "VIT", name: "Vitalidad", rule: "Días con algo registrado" },
  { id: "dis", abbr: "DIS", name: "Disciplina", rule: "Días dentro de tu objetivo de kcal" },
  { id: "int", abbr: "INT", name: "Inteligencia", rule: "Días con 3 comidas o más y pesajes" },
];

/** Puntos para subir del nivel 1 al 2; cada nivel siguiente pide este paso más (2 → 3 pide el doble…). */
export const STAT_STEP = 5;

/** Puntos acumulados necesarios para un nivel de atributo (1 → 0, 2 → 5, 3 → 15, 4 → 30, 10 → 225…). */
export const pointsForStatLevel = (level: number) => (STAT_STEP * (level - 1) * level) / 2;

export function statLevel(points: number): number {
  let level = 1;
  while (pointsForStatLevel(level + 1) <= points) level++;
  return level;
}

/** Días que mira la «forma actual». */
export const FORM_DAYS = 30;
const MIN_MEALS = 3;

export interface Stat extends StatInfo {
  points: number;
  level: number;
  /** Puntos dentro del nivel actual y los que pide el siguiente. */
  current: number;
  needed: number;
  /** % de los últimos días (hasta FORM_DAYS) en que se cumplió. */
  form: number;
}

export interface CharacterInput {
  /** Todo el diario. */
  entries: DiaryEntry[];
  weights: WeightLog[];
  targetsFor: (date: string) => Targets;
  today: string;
}

/** Resumen de cada día desde el primer registro hasta hoy. */
export function historyStats({ entries, targetsFor, today }: CharacterInput): DayStat[] {
  const first = entries.reduce((min, e) => (e.date < min ? e.date : min), today);
  return dayStats(entries, first, today, targetsFor);
}

/** Atributos a partir de todo el historial. La forma solo cuenta los días desde el primer registro. */
export function characterStats(input: CharacterInput, stats = historyStats(input)): Stat[] {
  const { entries, weights, today } = input;
  const meals = new Map<string, Set<string>>();
  for (const e of entries) {
    const set = meals.get(e.date) ?? new Set<string>();
    set.add(e.meal);
    meals.set(e.date, set);
  }
  const weighDays = new Set(weights.filter((w) => w.date <= today).map((w) => w.date));

  const checks: Record<StatId, (s: DayStat) => boolean> = {
    fue: (s) => s.status !== "none" && s.protein >= s.target.protein,
    vit: (s) => s.status !== "none",
    dis: (s) => s.status === "met",
    int: (s) => (meals.get(s.date)?.size ?? 0) >= MIN_MEALS,
  };
  const formFrom = addDaysISO(today, -(FORM_DAYS - 1));
  const recent = stats.filter((s) => s.date >= formFrom);

  return STATS.map((info) => {
    const check = checks[info.id];
    const points = stats.filter(check).length + (info.id === "int" ? weighDays.size : 0);
    const level = statLevel(points);
    const start = pointsForStatLevel(level);
    const form = recent.length > 0 ? Math.round((recent.filter(check).length / recent.length) * 100) : 0;
    return { ...info, points, level, current: points - start, needed: pointsForStatLevel(level + 1) - start, form };
  });
}

/** Mejor racha (con escudo) de todo el historial. */
export function bestStreak(activeDays: readonly string[]): number {
  return activeDays.reduce((best, d) => Math.max(best, shieldedStreak(activeDays, d).streak), 0);
}

/**
 * Misiones semanales completadas en todo el historial. Se recalculan desde el diario y los pesajes
 * (no desde `awarded`, que solo guarda los meses recientes), así el total nunca baja.
 */
export function weeklyQuestsDone(stats: DayStat[], weights: WeightLog[]): number {
  const weeks = new Map<string, DayStat[]>();
  for (const s of stats) {
    const start = weekStartISO(s.date);
    const list = weeks.get(start);
    if (list) list.push(s);
    else weeks.set(start, [s]);
  }
  let done = 0;
  for (const [start, days] of weeks) {
    const end = addDaysISO(start, 6);
    const weighIns = weights.filter((w) => w.date >= start && w.date <= end).length;
    done += weeklyQuests(days, weighIns).filter((q) => q.done).length;
  }
  return done;
}

/** Título según el nivel. */
const TITLES: [minLevel: number, title: string][] = [
  [50, "Leyenda"],
  [30, "Maestro"],
  [20, "Veterano"],
  [10, "Explorador"],
  [5, "Aprendiz"],
  [1, "Novato"],
];

export const levelTitle = (level: number) => TITLES.find(([min]) => level >= min)![1];
