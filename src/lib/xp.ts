import type { DiaryEntry, GameState, Macros, Targets } from "./types";

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

export interface Quest {
  id: string;
  label: string;
  xp: number;
  done: boolean;
  progress: string;
}

export function dailyQuests(entries: DiaryEntry[], totals: Macros, targets: Targets): Quest[] {
  const meals = new Set(entries.map((e) => e.meal)).size;
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
      label: "No pasarse de calorías",
      xp: 40,
      done: entries.length > 0 && totals.kcal <= targets.kcal,
      progress: `${Math.round(totals.kcal)}/${targets.kcal} kcal`,
    },
  ];
}

export const XP_PER_ENTRY = 10;
export const MAX_ENTRY_AWARDS = 8;
export const XP_STREAK = 15;

export interface XpSyncResult {
  state: GameState;
  gained: number;
  levelUp: number | null;
}

/** Otorga la XP pendiente del día sin duplicar recompensas ya dadas. */
export function syncDayXp(
  state: GameState,
  date: string,
  entries: DiaryEntry[],
  quests: Quest[],
  yesterday: string,
): XpSyncResult {
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

  let streak = state.streak;
  let lastActiveDate = state.lastActiveDate;
  if (entries.length > 0 && lastActiveDate !== date) {
    streak = lastActiveDate === yesterday ? streak + 1 : 1;
    lastActiveDate = date;
    give(`${date}:streak`, XP_STREAK);
  }

  const beforeLevel = levelFromXp(state.xp);
  const afterLevel = levelFromXp(xp);
  const history = state.history.filter((h) => h.date !== date);
  if (gained > 0 || entries.length > 0) history.push({ date, xp: Math.round(xp), level: afterLevel });
  history.sort((a, b) => a.date.localeCompare(b.date));

  return {
    state: { xp, streak, lastActiveDate, awarded: [...awarded].slice(-400), history: history.slice(-120) },
    gained,
    levelUp: afterLevel > beforeLevel ? afterLevel : null,
  };
}
