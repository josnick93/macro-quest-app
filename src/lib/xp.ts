import type { DiaryEntry, GameState, Macros, Targets } from "./types";
import { addDaysISO } from "./date";

export const XP_PER_LEVEL_BASE = 250;

/** XP acumulada necesaria para alcanzar un nivel. */
export const xpForLevel = (level: number) => XP_PER_LEVEL_BASE * (level - 1) * level * 0.5;

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    current: Math.round(xp - start),
    needed: Math.round(next - start),
    pct: Math.min(100, ((xp - start) / (next - start)) * 100),
  };
}

/**
 * Racha = días seguidos con registro que terminan hoy.
 * Si hoy aún no hay registro, la racha de ayer sigue viva (el día no ha acabado).
 */
export function currentStreak(activeDays: readonly string[], today: string): number {
  const days = new Set(activeDays);
  let cursor = days.has(today) ? today : addDaysISO(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}

export interface Quest {
  id: string;
  label: string;
  xp: number;
  done: boolean;
  progress: string;
}

/** Margen alrededor del objetivo de kcal que cuenta como día cumplido. */
export const KCAL_TOLERANCE = 0.1;

export function dailyQuests(entries: DiaryEntry[], totals: Macros, targets: Targets): Quest[] {
  const meals = new Set(entries.map((e) => e.meal)).size;
  const low = Math.round(targets.kcal * (1 - KCAL_TOLERANCE));
  const high = Math.round(targets.kcal * (1 + KCAL_TOLERANCE));
  return [
    { id: "meals3", label: "Registrar 3 comidas", xp: 40, done: meals >= 3, progress: `${Math.min(meals, 3)}/3` },
    {
      id: "protein",
      label: "Llegar al objetivo de proteína",
      xp: 60,
      done: totals.protein >= targets.protein,
      progress: `${Math.round(totals.protein)}/${targets.protein} g`,
    },
    {
      id: "kcal",
      label: "Quedar en tu objetivo de kcal (±10 %)",
      xp: 40,
      done: totals.kcal >= low && totals.kcal <= high,
      progress: `${Math.round(totals.kcal)} kcal · rango ${low}–${high}`,
    },
  ];
}

export const XP_PER_ENTRY = 10;
export const MAX_ENTRY_AWARDS = 8;
export const XP_ACTIVE_DAY = 15;

export interface XpSyncResult {
  state: GameState;
  gained: number;
  levelUp: number | null;
}

/**
 * Otorga la XP pendiente de un día sin duplicar recompensas ya dadas.
 * Nunca quita XP: borrar o pasarse no castiga.
 */
export function syncDayXp(state: GameState, date: string, entries: DiaryEntry[], quests: Quest[]): XpSyncResult {
  const awarded = new Set(state.awarded);
  let xp = state.xp;
  let gained = 0;
  const give = (key: string, amount: number) => {
    if (awarded.has(key)) return;
    awarded.add(key);
    xp += amount;
    gained += amount;
  };

  const entryCount = Math.min(entries.length, MAX_ENTRY_AWARDS);
  for (let i = 0; i < entryCount; i++) give(`${date}:entry:${i}`, XP_PER_ENTRY);
  for (const q of quests) if (q.done) give(`${date}:${q.id}`, q.xp);

  const activeDays =
    entries.length > 0 && !state.activeDays.includes(date) ? [...state.activeDays, date].sort() : state.activeDays;
  if (entries.length > 0) give(`${date}:streak`, XP_ACTIVE_DAY);

  const beforeLevel = levelFromXp(state.xp);
  const afterLevel = levelFromXp(xp);
  const history = state.history.filter((h) => h.date !== date);
  if (gained > 0 || entries.length > 0) history.push({ date, xp: Math.round(xp), level: afterLevel });
  history.sort((a, b) => a.date.localeCompare(b.date));

  return {
    // `awarded` solo necesita recordar los días recientes (~12 claves/día).
    state: { xp, activeDays, awarded: [...awarded].slice(-2000), history: history.slice(-400) },
    gained,
    levelUp: afterLevel > beforeLevel ? afterLevel : null,
  };
}
