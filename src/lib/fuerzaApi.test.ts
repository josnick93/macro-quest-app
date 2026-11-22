import { describe, expect, it } from "vitest";
import { summarizeFuerza, type FuerzaResponse, type FuerzaWorkout } from "./fuerzaApi";

const TODAY = "2026-11-22"; // domingo: la semana empieza el lunes 16

/** Entreno a las 18:00 hora local del día `date`. */
const w = (date: string, lifts: Record<string, number> = {}, prs = 0, title = "Torso A"): FuerzaWorkout => ({
  completedAt: new Date(`${date}T18:00:00`).toISOString(),
  title,
  prs,
  lifts,
});

const data = (workouts: FuerzaWorkout[], plannedPerWeek: number | null = 4): FuerzaResponse => ({ connected: true, plannedPerWeek, workouts });

describe("resumen de fuerza", () => {
  it("sin conectar o sin entrenos recientes no hay tarjeta", () => {
    expect(summarizeFuerza({ connected: false, plannedPerWeek: null, workouts: [] }, TODAY)).toBeNull();
    expect(summarizeFuerza(data([]), TODAY)).toBeNull();
  });

  it("cuenta entrenos y PRs de esta semana (lunes a domingo) y el último entreno", () => {
    const s = summarizeFuerza(data([w("2026-11-14", {}, 3), w("2026-11-17", {}, 1), w("2026-11-20", {}, 2, "Pierna B")]), TODAY)!;
    expect(s).toMatchObject({ weekSessions: 2, plannedPerWeek: 4, weekPrs: 3, lastWorkout: { title: "Pierna B", date: "2026-11-20" } });
  });

  it("compara el mejor e1RM de los últimos 14 días con los 14 anteriores", () => {
    const s = summarizeFuerza(
      data([w("2026-11-01", { "ex-banca-barra": 100 }), w("2026-11-18", { "ex-banca-barra": 102.5, "ex-sentadilla": 140 })]),
      TODAY,
    )!;
    expect(s.lifts).toEqual([
      { id: "ex-banca-barra", label: "Banca", e1rm: 102.5, changePct: 2.5 },
      { id: "ex-sentadilla", label: "Sentadilla", e1rm: 140, changePct: null },
    ]);
  });
});
