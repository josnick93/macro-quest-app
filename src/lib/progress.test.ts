import { describe, expect, it } from "vitest";
import { addMonths, dayStats, dayStatus, formatMonth, monthEnd, monthGrid, projectTarget, report, weightSeries, weightTrend } from "./progress";
import type { DiaryEntry, MealType, Targets, WeightLog } from "./types";

const target: Targets = { bmr: 1800, tdee: 2500, kcal: 2000, protein: 150, carbs: 200, fat: 60 };
const targetsFor = () => target;

let n = 0;
const entry = (date: string, meal: MealType, kcal: number, extra: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: `e${++n}`,
  date,
  meal,
  kind: "food",
  name: "Arroz",
  grams: 100,
  per100g: { kcal, protein: 10, carbs: 20, fat: 5 },
  createdAt: "",
  updatedAt: "",
  ...extra,
});
const w = (date: string, kg: number): WeightLog => ({ date, kg });

describe("peso", () => {
  it("la media móvil usa solo los pesajes de los 7 días anteriores a cada uno", () => {
    const series = weightSeries([w("2026-09-10", 80), w("2026-09-01", 82), w("2026-09-12", 79), w("2026-09-16", 78)]);
    expect(series.map((p) => p.date)).toEqual(["2026-09-01", "2026-09-10", "2026-09-12", "2026-09-16"]);
    expect(series.map((p) => p.avg)).toEqual([82, 80, 79.5, 79]);
    expect(weightSeries([])).toEqual([]);
  });

  it("el ritmo sale de la tendencia, no de la diferencia entre dos pesajes", () => {
    // Baja 0,1 kg al día de forma constante: −0,7 kg/semana.
    const steady = Array.from({ length: 15 }, (_, i) => w(`2026-09-${String(i + 1).padStart(2, "0")}`, 80 - i * 0.1));
    expect(weightTrend(steady, "2026-09-15")).toBe(-0.7);
    // Un pesaje disparatado en medio no cambia el signo.
    const noisy = steady.map((p, i) => (i === 7 ? { ...p, kg: 81.5 } : p));
    expect(weightTrend(noisy, "2026-09-15")).toBeLessThan(0);
  });

  it("sin pesajes suficientes o recientes no da ritmo", () => {
    expect(weightTrend([w("2026-09-01", 80), w("2026-09-10", 79)], "2026-09-15")).toBeNull();
    expect(weightTrend([w("2026-09-10", 80), w("2026-09-12", 79.8), w("2026-09-14", 79.6)], "2026-09-15")).toBeNull();
    // Los de hace más de 4 semanas no cuentan.
    expect(weightTrend([w("2026-06-01", 85), w("2026-06-10", 84), w("2026-06-20", 83)], "2026-09-15")).toBeNull();
  });

  it("proyecta la fecha del peso objetivo solo si el peso va hacia él", () => {
    expect(projectTarget(80, 76, -0.5, "2026-10-01")).toEqual({ kind: "date", date: "2026-11-26", weeks: 8 });
    expect(projectTarget(70, 73, 0.25, "2026-10-01")).toMatchObject({ kind: "date", weeks: 12 });
    expect(projectTarget(80, 76, 0.2, "2026-10-01")).toEqual({ kind: "away" });
    expect(projectTarget(80, 76, 0, "2026-10-01")).toEqual({ kind: "away" });
    expect(projectTarget(80, 60, -0.05, "2026-10-01")).toEqual({ kind: "away" });
    expect(projectTarget(76.1, 76, -0.5, "2026-10-01")).toEqual({ kind: "reached" });
  });
});

describe("días", () => {
  it("clasifica cada día con el margen del ±10 %", () => {
    expect(dayStatus(0, 2000)).toBe("none");
    expect(dayStatus(1799, 2000)).toBe("under");
    expect(dayStatus(1800, 2000)).toBe("met");
    expect(dayStatus(2200, 2000)).toBe("met");
    expect(dayStatus(2201, 2000)).toBe("over");
  });

  it("devuelve un día por fecha, también los que no tienen registro, con el objetivo de ese día", () => {
    const stats = dayStats([entry("2026-10-01", "comida", 1900), entry("2026-10-03", "cena", 2500)], "2026-10-01", "2026-10-03", (d) =>
      d === "2026-10-03" ? { ...target, kcal: 2400 } : target,
    );
    expect(stats.map((s) => [s.date, s.status])).toEqual([
      ["2026-10-01", "met"],
      ["2026-10-02", "none"],
      ["2026-10-03", "met"],
    ]);
    expect(stats[2]!.target.kcal).toBe(2400);
  });
});

describe("informe", () => {
  const entries = [
    entry("2026-10-01", "desayuno", 500, { foodId: "off:1", name: "Avena" }),
    entry("2026-10-01", "comida", 1500),
    entry("2026-10-02", "desayuno", 500, { foodId: "off:1", name: "Avena" }),
    entry("2026-10-02", "cena", 2000, { kind: "quick", name: "Cena fuera" }),
    entry("2026-09-20", "comida", 9000, { name: "Fuera del periodo" }),
  ];
  const stats = dayStats(entries, "2026-10-01", "2026-10-04", targetsFor);
  const r = report(entries, stats);

  it("las medias cuentan solo los días registrados", () => {
    expect(r).toMatchObject({ days: 4, logged: 2, met: 1, over: 1 });
    expect(r.avg.kcal).toBe(2250);
    expect(r.avgTarget.kcal).toBe(2000);
  });

  it("reparte las kcal por comida y omite las comidas vacías", () => {
    expect(r.meals.map((m) => [m.meal, m.kcal, m.pct])).toEqual([
      ["desayuno", 1000, 22],
      ["comida", 1500, 33],
      ["cena", 2000, 44],
    ]);
  });

  it("los más consumidos van por veces, sin añadidos rápidos ni días de fuera", () => {
    expect(r.top).toEqual([
      { name: "Avena", times: 2, kcal: 1000 },
      { name: "Arroz", times: 1, kcal: 1500 },
    ]);
  });

  it("sin registros no divide por cero", () => {
    const empty = report([], dayStats([], "2026-10-01", "2026-10-07", targetsFor));
    expect(empty).toMatchObject({ days: 7, logged: 0, met: 0, avg: { kcal: 0 }, meals: [], top: [] });
  });
});

describe("calendario", () => {
  it("la rejilla empieza en lunes y tiene todos los días del mes", () => {
    const oct = monthGrid("2026-10"); // el 1 de octubre de 2026 es jueves
    expect(oct.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(oct.filter(Boolean)).toHaveLength(31);
    expect(monthGrid("2026-06")[0]).toBe("2026-06-01"); // lunes: sin huecos
    expect(monthGrid("2028-02").filter(Boolean)).toHaveLength(29);
  });
  it("cambia de mes cruzando el año", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(formatMonth("2026-10")).toBe("Octubre de 2026");
  });
});
