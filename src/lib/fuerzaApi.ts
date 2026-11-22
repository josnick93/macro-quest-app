/**
 * Datos de Cazador de Fuerza (app hermana, misma cuenta y misma D1) que muestra MacroQuest: GET /api/fuerza.
 * El worker solo LEE la tabla `fuerza_records` de Cazador; nunca escribe en ella.
 */
import { addDaysISO, diffDays, toISODate, weekdayIndex } from "./date";

export const FUERZA_URL = "https://fuerza.macroquestapp.com";

/** Días hacia atrás que devuelve el worker. */
export const FUERZA_DAYS = 35;

/** Básicos que se resumen. Los ids son los del catálogo de Cazador (src/data/exercises.ts allí). */
export const FUERZA_LIFTS = [
  { id: "ex-banca-barra", label: "Banca" },
  { id: "ex-sentadilla", label: "Sentadilla" },
  { id: "ex-peso-muerto", label: "Peso muerto" },
  { id: "ex-press-militar", label: "Militar" },
  { id: "ex-dominadas", label: "Dominadas" },
] as const;

/** Un entreno, ya reducido por el worker a lo que hace falta aquí. */
export interface FuerzaWorkout {
  /** ISO datetime en UTC. */
  completedAt: string;
  title: string;
  /** Récords personales de la sesión. */
  prs: number;
  /** Mejor e1RM (kg) de cada básico hecho en la sesión. */
  lifts: Record<string, number>;
}

export interface FuerzaResponse {
  /** false si la cuenta no usa Cazador de Fuerza. */
  connected: boolean;
  /** Días de entreno por semana del plan de Cazador. */
  plannedPerWeek: number | null;
  workouts: FuerzaWorkout[];
}

export interface FuerzaLiftSummary {
  id: string;
  label: string;
  /** Mejor e1RM reciente (kg). */
  e1rm: number;
  /** Cambio de los últimos 14 días frente a los 14 anteriores, en %; null si falta uno de los dos. */
  changePct: number | null;
}

export interface FuerzaSummary {
  weekSessions: number;
  plannedPerWeek: number | null;
  weekPrs: number;
  lifts: FuerzaLiftSummary[];
  lastWorkout: { title: string; date: string } | null;
}

/** Resumen de la semana (lunes a domingo) con la fecha local de hoy. null si no hay entrenos recientes. */
export function summarizeFuerza(data: FuerzaResponse, today: string): FuerzaSummary | null {
  if (!data.connected || data.workouts.length === 0) return null;
  const withDate = data.workouts
    .map((w) => ({ ...w, date: toISODate(new Date(w.completedAt)) }))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const weekStart = addDaysISO(today, -weekdayIndex(today));
  const week = withDate.filter((w) => w.date >= weekStart && w.date <= today);

  const lifts: FuerzaLiftSummary[] = [];
  for (const lift of FUERZA_LIFTS) {
    let recent = 0;
    let previous = 0;
    for (const w of withDate) {
      const e1rm = w.lifts[lift.id];
      if (!e1rm) continue;
      const age = diffDays(w.date, today);
      if (age < 0) continue;
      if (age < 14) recent = Math.max(recent, e1rm);
      else if (age < 28) previous = Math.max(previous, e1rm);
    }
    const best = recent || previous;
    if (!best) continue;
    lifts.push({
      id: lift.id,
      label: lift.label,
      e1rm: best,
      changePct: recent && previous ? Math.round((recent / previous - 1) * 1000) / 10 : null,
    });
  }

  const last = withDate[withDate.length - 1]!;
  return {
    weekSessions: week.length,
    plannedPerWeek: data.plannedPerWeek,
    weekPrs: week.reduce((sum, w) => sum + w.prs, 0),
    lifts,
    lastWorkout: { title: last.title, date: last.date },
  };
}

/** Pide los datos al worker. null si no hay sesión, servidor o conexión. */
export async function fetchFuerza(): Promise<FuerzaResponse | null> {
  try {
    const res = await fetch("/api/fuerza", { credentials: "same-origin" });
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return null;
    return (await res.json()) as FuerzaResponse;
  } catch {
    return null;
  }
}
