import type { GameState, Profile } from "./types";
import type { DayStat } from "./progress";
import { ACHIEVEMENT_XP, achievementKey, grantAwards, levelFromXp, weeklyKey, WEEKLY_XP, type Quest } from "./xp";

/** Misiones semanales y logros. Como todo el juego: premian constancia y registro, nunca castigan. */

// ---------- misiones semanales ----------

/** Misiones de una semana (lunes a domingo) a partir del resumen de sus 7 días y sus pesajes. */
export function weeklyQuests(stats: DayStat[], weighIns: number): Quest[] {
  const logged = stats.filter((s) => s.status !== "none").length;
  const met = stats.filter((s) => s.status === "met").length;
  const protein = stats.filter((s) => s.status !== "none" && s.protein >= s.target.protein).length;
  const quest = (id: string, label: string, value: number, goal: number): Quest => ({
    id,
    label,
    xp: WEEKLY_XP[id] ?? 0,
    done: value >= goal,
    progress: `${Math.min(value, goal)}/${goal}`,
  });
  return [
    quest("kcal5", "5 días en tu objetivo de kcal", met, 5),
    quest("protein5", "Llegar a la proteína 5 días", protein, 5),
    quest("log7", "Registrar los 7 días", logged, 7),
    quest("weigh3", "Pesarte 3 veces", weighIns, 3),
  ];
}

export interface Week {
  /** Lunes de la semana. */
  start: string;
  quests: Quest[];
}

// ---------- logros ----------

export interface Achievement {
  id: string;
  title: string;
  description: string;
  xp: number;
}

const achievement = (id: string, title: string, description: string): Achievement => ({ id, title, description, xp: ACHIEVEMENT_XP[id] ?? 0 });

export const ACHIEVEMENTS: Achievement[] = [
  achievement("first-entry", "Primer paso", "Registra tu primer alimento"),
  achievement("first-scan", "Ojo de lince", "Escanea un código de barras"),
  achievement("first-custom-food", "Receta de la casa", "Crea un alimento propio"),
  achievement("first-recipe", "Aprendiz de cocina", "Guarda tu primera receta"),
  achievement("first-weight", "Punto de partida", "Registra tu primer peso"),
  achievement("streak-7", "Semana de hierro", "Llega a 7 días de racha"),
  achievement("streak-30", "Voluntad de acero", "Llega a 30 días de racha"),
  achievement("streak-100", "Leyenda constante", "Llega a 100 días de racha"),
  achievement("entries-100", "Diario del cazador", "Registra 100 alimentos"),
  achievement("entries-500", "Cronista incansable", "Registra 500 alimentos"),
  achievement("week-complete", "Semana perfecta", "Completa todas las misiones de una semana"),
  achievement("level-5", "Rango ascendente", "Alcanza el nivel 5"),
  achievement("target-weight", "Meta alcanzada", "Llega a tu peso objetivo"),
];

/** Lo que hace falta saber, además del estado del juego, para comprobar los logros. */
export interface AchievementContext {
  streak: number;
  /** Entradas del diario en total. */
  entries: number;
  recipes: number;
  customFoods: number;
  weighIns: number;
  /** Se ha escaneado algún código en este dispositivo. */
  scanned: boolean;
  atTargetWeight: boolean;
}

/** Margen en kg para dar por alcanzado el peso objetivo. */
const TARGET_MARGIN_KG = 0.2;

/** ¿Ha llegado al peso objetivo (o lo ha pasado en la dirección de su plan)? */
export function reachedTarget(profile: Pick<Profile, "goal" | "targetWeightKg">, latestKg: number | undefined): boolean {
  const target = profile.targetWeightKg;
  if (!target || latestKg === undefined) return false;
  if (profile.goal === "perder") return latestKg <= target + TARGET_MARGIN_KG;
  if (profile.goal === "ganar") return latestKg >= target - TARGET_MARGIN_KG;
  return Math.abs(latestKg - target) <= TARGET_MARGIN_KG;
}

/** Ids de los logros cuya condición se cumple ahora mismo. */
export function earnedAchievements(game: GameState, ctx: AchievementContext, weekComplete: boolean): string[] {
  const checks: Record<string, boolean> = {
    "first-entry": game.activeDays.length > 0 || ctx.entries > 0,
    "first-scan": ctx.scanned,
    "first-custom-food": ctx.customFoods > 0,
    "first-recipe": ctx.recipes > 0,
    "first-weight": ctx.weighIns > 0,
    "streak-7": ctx.streak >= 7,
    "streak-30": ctx.streak >= 30,
    "streak-100": ctx.streak >= 100,
    "entries-100": ctx.entries >= 100,
    "entries-500": ctx.entries >= 500,
    "week-complete": weekComplete,
    "level-5": levelFromXp(game.xp) >= 5,
    "target-weight": ctx.atTargetWeight,
  };
  return ACHIEVEMENTS.filter((a) => checks[a.id]).map((a) => a.id);
}

export interface GameSyncResult {
  state: GameState;
  gained: number;
  levelUp: number | null;
  /** Misiones semanales recién completadas y logros recién desbloqueados, para avisar. */
  weeklyDone: Quest[];
  unlocked: Achievement[];
}

/**
 * Da la XP de las misiones semanales completadas y desbloquea los logros conseguidos, sin repetir ninguno.
 * `now` es el instante (ISO) que queda como fecha de los logros nuevos.
 */
export function syncGame(state: GameState, today: string, weeks: Week[], ctx: AchievementContext, now: string): GameSyncResult {
  const before = levelFromXp(state.xp);
  const awardedBefore = new Set(state.awarded);
  const weekly = weeks.flatMap((w) => w.quests.filter((q) => q.done).map((q) => ({ key: weeklyKey(w.start, q.id), xp: q.xp, quest: q })));
  const weeklyDone = weekly.filter((w) => !awardedBefore.has(w.key)).map((w) => w.quest);
  let result = grantAwards(state, today, weekly);
  let gained = result.gained;

  // Los logros se miran después de las semanales: la XP recién ganada puede dar el de nivel.
  const weekComplete = weeks.some((w) => w.quests.length > 0 && w.quests.every((q) => q.done));
  const fresh = earnedAchievements(result.state, ctx, weekComplete).filter((id) => !result.state.achievements[id]);
  const unlocked = ACHIEVEMENTS.filter((a) => fresh.includes(a.id));
  if (unlocked.length > 0) {
    const withDates: GameState = { ...result.state, achievements: { ...result.state.achievements, ...Object.fromEntries(unlocked.map((a) => [a.id, now])) } };
    result = grantAwards(withDates, today, unlocked.map((a) => ({ key: achievementKey(a.id), xp: a.xp })));
    gained += result.gained;
  }

  const after = levelFromXp(result.state.xp);
  return { state: result.state, gained, levelUp: after > before ? after : null, weeklyDone, unlocked };
}
