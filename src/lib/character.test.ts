import { describe, expect, it } from "vitest";
import { addDaysISO } from "./date";
import { bestStreak, characterStats, historyStats, levelTitle, pointsForStatLevel, statLevel, weeklyQuestsDone, type StatId } from "./character";
import type { DiaryEntry, MealType, Targets } from "./types";

const target: Targets = { bmr: 1800, tdee: 2500, kcal: 2000, protein: 150, carbs: 200, fat: 60 };
const TODAY = "2026-10-05";

let n = 0;
const entry = (date: string, kcal: number, protein: number, meal: MealType = "comida"): DiaryEntry => ({
  id: `e${++n}`,
  date,
  meal,
  kind: "food",
  name: "x",
  grams: 100,
  per100g: { kcal, protein, carbs: 0, fat: 0 },
  createdAt: "",
  updatedAt: "",
});
const sheet = (entries: DiaryEntry[], weighDays: string[] = []) => {
  const stats = characterStats({ entries, weights: weighDays.map((date) => ({ date, kg: 80 })), targetsFor: () => target, today: TODAY });
  return Object.fromEntries(stats.map((s) => [s.id, s])) as Record<StatId, (typeof stats)[number]>;
};

describe("nivel de atributo", () => {
  it("cada nivel pide más que el anterior", () => {
    expect([1, 2, 3, 4, 10].map(pointsForStatLevel)).toEqual([0, 5, 15, 30, 225]);
    expect([0, 4, 5, 14, 15, 225].map(statLevel)).toEqual([1, 1, 2, 2, 3, 10]);
  });
});

describe("atributos", () => {
  it("sin registros todo está a nivel 1 y forma 0", () => {
    const s = sheet([]);
    expect(Object.values(s).map((x) => [x.level, x.points, x.form])).toEqual([
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
    ]);
  });

  it("cada atributo cuenta su hábito", () => {
    const entries = [
      // En objetivo y con proteína, 3 comidas.
      entry("2026-10-01", 700, 50, "desayuno"),
      entry("2026-10-01", 700, 50, "comida"),
      entry("2026-10-01", 700, 50, "cena"),
      // Se pasa de kcal pero llega a la proteína.
      entry("2026-10-02", 3000, 200),
      // Registrado, por debajo y sin proteína.
      entry("2026-10-03", 500, 10),
    ];
    const s = sheet(entries, ["2026-10-02", "2026-10-03", "2026-10-03"]);
    expect(s.vit.points).toBe(3);
    expect(s.fue.points).toBe(2);
    expect(s.dis.points).toBe(1);
    // Un día con 3 comidas + 2 días de pesaje (el repetido cuenta una vez).
    expect(s.int.points).toBe(3);
  });

  it("la forma mira solo desde el primer registro y como mucho 30 días", () => {
    const s = sheet([entry("2026-10-04", 2000, 200)]);
    // 2 días (ayer y hoy, aún sin registrar): 1 de 2.
    expect(s.vit.form).toBe(50);
    const old = sheet([entry("2026-01-01", 2000, 200), entry("2026-10-05", 2000, 200)]);
    expect(old.vit.points).toBe(2);
    expect(old.vit.form).toBe(Math.round(100 / 30));
  });

  it("los puntos nunca bajan: un mes flojo solo baja la forma", () => {
    const strong = Array.from({ length: 20 }, (_, i) => entry(`2026-08-${String(i + 1).padStart(2, "0")}`, 2000, 200));
    const s = sheet(strong);
    expect(s.vit.points).toBe(20);
    expect(s.vit.level).toBe(statLevel(20));
    expect(s.vit.form).toBe(0);
  });

  it("progreso dentro del nivel", () => {
    const entries = Array.from({ length: 7 }, (_, i) => entry(`2026-10-0${i + 1}`, 2000, 0));
    const s = sheet(entries);
    expect(s.vit).toMatchObject({ points: 5, level: 2, current: 0, needed: 10 });
  });
});

describe("resumen", () => {
  it("mejor racha del historial, con escudo", () => {
    expect(bestStreak([])).toBe(0);
    // 3 días seguidos, hueco largo, 5 seguidos con un día perdonado (jueves 2026-10-01).
    const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-02", "2026-10-03"];
    expect(bestStreak(days)).toBe(5);
  });

  it("cuenta misiones semanales completadas en todo el historial", () => {
    // Semana del 28/9 completa (7 días en objetivo con proteína + 3 pesajes). La del 21/9 es anterior al primer registro: no cuenta.
    const entries = Array.from({ length: 7 }, (_, i) => entry(addDaysISO("2026-09-28", i), 2000, 200));
    const weights = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-28", "2026-09-29", "2026-09-30"].map((date) => ({ date, kg: 80 }));
    const input = { entries, weights, targetsFor: () => target, today: TODAY };
    expect(weeklyQuestsDone(historyStats(input), weights)).toBe(4);
  });

  it("títulos por nivel", () => {
    expect([1, 4, 5, 9, 10, 20, 30, 49, 50, 80].map(levelTitle)).toEqual([
      "Novato",
      "Novato",
      "Aprendiz",
      "Aprendiz",
      "Explorador",
      "Veterano",
      "Maestro",
      "Maestro",
      "Leyenda",
      "Leyenda",
    ]);
  });
});
