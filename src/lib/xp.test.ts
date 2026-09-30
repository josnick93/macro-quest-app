import { describe, expect, it } from "vitest";
import { currentStreak, dailyQuests, levelFromXp, syncDayXp, xpForLevel } from "./xp";
import { DEFAULT_GAME } from "./repos/migrations";
import type { DiaryEntry, Targets } from "./types";

const targets: Targets = { bmr: 1800, tdee: 2600, kcal: 2000, protein: 150, carbs: 200, fat: 60 };

const entry = (date: string, meal: DiaryEntry["meal"], kcal: number, protein = 0): DiaryEntry => ({
  id: `${date}-${meal}-${kcal}`,
  date,
  meal,
  kind: "food",
  name: "x",
  grams: 100,
  per100g: { kcal, protein, carbs: 0, fat: 0 },
  createdAt: "",
  updatedAt: "",
});

describe("niveles", () => {
  it("xpForLevel y levelFromXp son coherentes", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(250);
    expect(levelFromXp(249)).toBe(1);
    expect(levelFromXp(250)).toBe(2);
  });
});

describe("currentStreak", () => {
  it("cuenta días seguidos hasta hoy", () => {
    expect(currentStreak(["2026-09-28", "2026-09-29", "2026-09-30"], "2026-09-30")).toBe(3);
  });
  it("si hoy aún no hay registro, mantiene la racha de ayer", () => {
    expect(currentStreak(["2026-09-28", "2026-09-29"], "2026-09-30")).toBe(2);
  });
  it("se rompe si falta un día completo", () => {
    expect(currentStreak(["2026-09-25", "2026-09-26"], "2026-09-30")).toBe(0);
    expect(currentStreak(["2026-09-26", "2026-09-28", "2026-09-29"], "2026-09-29")).toBe(2);
  });
  it("cruza meses", () => {
    expect(currentStreak(["2026-08-31", "2026-09-01"], "2026-09-01")).toBe(2);
  });
});

describe("misión de kcal (±10 %)", () => {
  const kcalQuest = (kcal: number) => dailyQuests([entry("d", "comida", kcal)], { kcal, protein: 0, carbs: 0, fat: 0 }, targets).find((q) => q.id === "kcal")!;
  it("no se cumple con poco registrado", () => expect(kcalQuest(500).done).toBe(false));
  it("se cumple dentro del rango", () => {
    expect(kcalQuest(1800).done).toBe(true);
    expect(kcalQuest(2200).done).toBe(true);
  });
  it("no se cumple muy por encima", () => expect(kcalQuest(2300).done).toBe(false));
});

describe("syncDayXp", () => {
  const day = "2026-09-30";
  const entries = [entry(day, "desayuno", 500, 40), entry(day, "comida", 800, 60)];
  const quests = dailyQuests(entries, { kcal: 1300, protein: 100, carbs: 0, fat: 0 }, targets);

  it("otorga XP por entradas y día activo, y marca el día activo", () => {
    const r = syncDayXp(DEFAULT_GAME, day, entries, quests);
    expect(r.gained).toBe(2 * 10 + 15);
    expect(r.state.activeDays).toEqual([day]);
  });

  it("es idempotente: no duplica XP", () => {
    const first = syncDayXp(DEFAULT_GAME, day, entries, quests).state;
    const again = syncDayXp(first, day, entries, quests);
    expect(again.gained).toBe(0);
    expect(again.state.xp).toBe(first.xp);
  });

  it("nunca quita XP al borrar entradas", () => {
    const first = syncDayXp(DEFAULT_GAME, day, entries, quests).state;
    const after = syncDayXp(first, day, [], []);
    expect(after.state.xp).toBe(first.xp);
  });

  it("conserva la XP previa", () => {
    const prev = { ...DEFAULT_GAME, xp: 5000, activeDays: ["2026-09-29"] };
    const r = syncDayXp(prev, day, entries, quests);
    expect(r.state.xp).toBe(5000 + r.gained);
    expect(r.state.activeDays).toEqual(["2026-09-29", day]);
  });
});
