import type { DiaryEntry, GameState, Macros, Targets } from "./types";
import { addDaysISO, weekdayIndex } from "./date";

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

/** Lunes de la semana de una fecha. */
export const weekStartISO = (iso: string): string => addDaysISO(iso, -weekdayIndex(iso));

export interface ShieldedStreak {
  /** Días con registro de la racha (los días perdonados no suman). */
  streak: number;
  /** El escudo de esta semana sigue sin gastar. */
  shieldReady: boolean;
  /** Días sin registro que el escudo ha perdonado dentro de la racha actual. */
  forgiven: string[];
}

/**
 * Racha con escudo: cada semana (de lunes a domingo) se perdona un día sin registro.
 * Se calcula con los días activos, sin guardar nada: el escudo se gasta y se recarga solo, y nunca resta.
 */
export function shieldedStreak(activeDays: readonly string[], today: string): ShieldedStreak {
  const days = new Set(activeDays);
  const used = new Set<string>();
  const forgiven: string[] = [];
  let streak = 0;
  // Hoy aún no ha terminado: si no hay registro, ni rompe la racha ni gasta el escudo.
  let cursor = days.has(today) ? today : addDaysISO(today, -1);
  let pending: string[] = [];
  for (;;) {
    if (days.has(cursor)) {
      streak++;
      forgiven.push(...pending);
      pending = [];
    } else {
      const week = weekStartISO(cursor);
      if (used.has(week)) break;
      used.add(week);
      pending.push(cursor);
    }
    cursor = addDaysISO(cursor, -1);
  }
  // Los huecos del final, sin días de racha detrás, no han protegido nada: su escudo no cuenta como gastado.
  const spent = new Set(forgiven.map(weekStartISO));
  return { streak, shieldReady: !spent.has(weekStartISO(today)), forgiven };
}

export interface Quest {
  id: string;
  label: string;
  xp: number;
  done: boolean;
  progress: string;
}

/** XP de cada misión diaria. */
export const QUEST_XP = { meals3: 40, protein: 60, kcal: 40 } as const;

/** Margen alrededor del objetivo de kcal que cuenta como día cumplido. */
export const KCAL_TOLERANCE = 0.1;

export function dailyQuests(entries: DiaryEntry[], totals: Macros, targets: Targets): Quest[] {
  const meals = new Set(entries.map((e) => e.meal)).size;
  const low = Math.round(targets.kcal * (1 - KCAL_TOLERANCE));
  const high = Math.round(targets.kcal * (1 + KCAL_TOLERANCE));
  return [
    { id: "meals3", label: "Registrar 3 comidas", xp: QUEST_XP.meals3, done: meals >= 3, progress: `${Math.min(meals, 3)}/3` },
    {
      id: "protein",
      label: "Llegar al objetivo de proteína",
      xp: QUEST_XP.protein,
      done: totals.protein >= targets.protein,
      progress: `${Math.round(totals.protein)}/${targets.protein} g`,
    },
    {
      id: "kcal",
      label: "Quedar en tu objetivo de kcal (±10 %)",
      xp: QUEST_XP.kcal,
      done: totals.kcal >= low && totals.kcal <= high,
      progress: `${Math.round(totals.kcal)} kcal · rango ${low}–${high}`,
    },
  ];
}

export const XP_PER_ENTRY = 10;
export const MAX_ENTRY_AWARDS = 8;
export const XP_ACTIVE_DAY = 15;

/** XP de cada misión semanal. */
export const WEEKLY_XP: Record<string, number> = { kcal5: 150, protein5: 150, log7: 100, weigh3: 75 };

/** XP de cada logro (los logros se definen en gamification.ts). */
export const ACHIEVEMENT_XP: Record<string, number> = {
  "first-entry": 50,
  "first-scan": 50,
  "first-recipe": 50,
  "first-custom-food": 50,
  "first-weight": 50,
  "streak-7": 100,
  "streak-30": 300,
  "streak-100": 600,
  "entries-100": 150,
  "entries-500": 300,
  "week-complete": 200,
  "level-5": 150,
  "target-weight": 300,
};

export const ACHIEVEMENT_PREFIX = "logro:";
export const weeklyKey = (weekStart: string, id: string) => `${weekStart}:w:${id}`;
export const achievementKey = (id: string) => ACHIEVEMENT_PREFIX + id;

/** Recompensas que se recuerdan como ya dadas y días de historial que se guardan. */
export const MAX_AWARDED = 2000;
export const MAX_HISTORY = 400;

/** XP que vale una recompensa ya dada, a partir de su clave ("2026-10-02:entry:3", "2026-10-02:protein", "2026-09-28:w:kcal5", "logro:streak-7"…). */
export function awardXp(key: string): number {
  if (key.startsWith(ACHIEVEMENT_PREFIX)) return ACHIEVEMENT_XP[key.slice(ACHIEVEMENT_PREFIX.length)] ?? 0;
  const kind = key.slice(11);
  if (kind.startsWith("entry:")) return XP_PER_ENTRY;
  if (kind.startsWith("w:")) return WEEKLY_XP[kind.slice(2)] ?? 0;
  if (kind === "streak") return XP_ACTIVE_DAY;
  return (QUEST_XP as Record<string, number>)[kind] ?? 0;
}

/**
 * Une el estado de juego de dos dispositivos sin perder nada: cada recompensa cuenta una vez
 * y la XP de las que solo tenía el otro se suma. Nunca baja la XP de ninguno de los dos.
 */
export function mergeGame(a: GameState, b: GameState): GameState {
  const gainFrom = (mine: GameState, other: GameState) => {
    const have = new Set(mine.awarded);
    // Un logro ya desbloqueado aquí está contado aunque su recompensa se haya olvidado.
    for (const id of Object.keys(mine.achievements)) have.add(achievementKey(id));
    // Si mi lista está llena, las recompensas anteriores a la primera que recuerdo ya las conté y olvidé.
    const oldest = mine.awarded.length >= MAX_AWARDED ? [...mine.awarded].sort()[0]! : "";
    return other.awarded.reduce((sum, key) => (have.has(key) || key < oldest ? sum : sum + awardXp(key)), 0);
  };
  const xp = Math.max(a.xp + gainFrom(a, b), b.xp + gainFrom(b, a));
  const history = new Map<string, GameState["history"][number]>();
  for (const h of [...a.history, ...b.history]) {
    const seen = history.get(h.date);
    if (!seen || h.xp > seen.xp) history.set(h.date, h);
  }
  // Cada logro conserva la fecha más antigua en que se consiguió.
  const achievements: Record<string, string> = {};
  for (const id of [...new Set([...Object.keys(a.achievements), ...Object.keys(b.achievements)])].sort()) {
    const dates = [a.achievements[id], b.achievements[id]].filter((d): d is string => !!d).sort();
    achievements[id] = dates[0]!;
  }
  return {
    xp,
    activeDays: [...new Set([...a.activeDays, ...b.activeDays])].sort(),
    awarded: [...new Set([...a.awarded, ...b.awarded])].sort().slice(-MAX_AWARDED),
    history: [...history.values()].sort((x, y) => x.date.localeCompare(y.date)).slice(-MAX_HISTORY),
    achievements,
  };
}

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
    state: { ...state, xp, activeDays, awarded: [...awarded].slice(-MAX_AWARDED), history: history.slice(-MAX_HISTORY) },
    gained,
    levelUp: afterLevel > beforeLevel ? afterLevel : null,
  };
}

/**
 * Da recompensas sueltas (misiones semanales, logros) que aún no se hubieran dado.
 * El historial del día `date` refleja la XP resultante.
 */
export function grantAwards(state: GameState, date: string, awards: { key: string; xp: number }[]): XpSyncResult {
  const awarded = new Set(state.awarded);
  let gained = 0;
  for (const a of awards) {
    if (awarded.has(a.key)) continue;
    awarded.add(a.key);
    gained += a.xp;
  }
  if (gained === 0) return { state, gained: 0, levelUp: null };
  const xp = state.xp + gained;
  const beforeLevel = levelFromXp(state.xp);
  const afterLevel = levelFromXp(xp);
  const history = [...state.history.filter((h) => h.date !== date), { date, xp: Math.round(xp), level: afterLevel }].sort((a, b) => a.date.localeCompare(b.date));
  return {
    state: { ...state, xp, awarded: [...awarded].slice(-MAX_AWARDED), history: history.slice(-MAX_HISTORY) },
    gained,
    levelUp: afterLevel > beforeLevel ? afterLevel : null,
  };
}
