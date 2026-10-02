import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, earnedAchievements, reachedTarget, syncGame, weeklyQuests, type AchievementContext, type Week } from "./gamification";
import { dayStats } from "./progress";
import { DEFAULT_GAME, normalizeGame, parseImport, SCHEMA_VERSION } from "./repos/migrations";
import { ACHIEVEMENT_XP, WEEKLY_XP, xpForLevel } from "./xp";
import type { DiaryEntry, Targets } from "./types";

const target: Targets = { bmr: 1800, tdee: 2500, kcal: 2000, protein: 150, carbs: 200, fat: 60 };
const NOW = "2026-10-02T10:00:00.000Z";
const MONDAY = "2026-09-28";

let n = 0;
const day = (date: string, kcal: number, protein: number): DiaryEntry => ({
  id: `e${++n}`,
  date,
  meal: "comida",
  kind: "food",
  name: "x",
  grams: 100,
  per100g: { kcal, protein, carbs: 0, fat: 0 },
  createdAt: "",
  updatedAt: "",
});
const week = (entries: DiaryEntry[], weighIns = 0) => weeklyQuests(dayStats(entries, MONDAY, "2026-10-04", () => target), weighIns);
const done = (quests: ReturnType<typeof week>) => Object.fromEntries(quests.map((q) => [q.id, q.done]));

const ctx = (over: Partial<AchievementContext> = {}): AchievementContext => ({
  streak: 0,
  entries: 0,
  recipes: 0,
  customFoods: 0,
  weighIns: 0,
  scanned: false,
  atTargetWeight: false,
  ...over,
});

describe("misiones semanales", () => {
  it("cuentan días en objetivo, días con proteína, días registrados y pesajes", () => {
    const entries = [
      day("2026-09-28", 2000, 160),
      day("2026-09-29", 2100, 150),
      day("2026-09-30", 1900, 100),
      day("2026-10-01", 2600, 170), // por encima: no cuenta como día en objetivo, pero sí su proteína
      day("2026-10-02", 1200, 80),
    ];
    const quests = week(entries, 2);
    expect(quests.map((q) => [q.id, q.progress])).toEqual([
      ["kcal5", "3/5"],
      ["protein5", "3/5"],
      ["log7", "5/7"],
      ["weigh3", "2/3"],
    ]);
    expect(quests.every((q) => !q.done)).toBe(true);
    expect(quests.map((q) => q.xp)).toEqual([WEEKLY_XP.kcal5, WEEKLY_XP.protein5, WEEKLY_XP.log7, WEEKLY_XP.weigh3]);
  });

  it("se completan al llegar a la meta y el progreso no pasa de ella", () => {
    const entries = Array.from({ length: 7 }, (_, i) => day(`2026-${i < 3 ? "09" : "10"}-${String(i < 3 ? 28 + i : i - 2).padStart(2, "0")}`, 2000, 150));
    const quests = week(entries, 5);
    expect(done(quests)).toEqual({ kcal5: true, protein5: true, log7: true, weigh3: true });
    expect(quests.find((q) => q.id === "weigh3")!.progress).toBe("3/3");
    expect(quests.find((q) => q.id === "kcal5")!.progress).toBe("5/5");
  });

  it("una semana vacía no completa nada", () => {
    expect(week([]).some((q) => q.done)).toBe(false);
  });
});

describe("logros", () => {
  it("cada logro tiene XP y no hay ids repetidos", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.every((a) => a.xp > 0 && a.xp === ACHIEVEMENT_XP[a.id])).toBe(true);
    expect(Object.keys(ACHIEVEMENT_XP).sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
  });

  it("se cumplen según los hábitos reales", () => {
    expect(earnedAchievements(DEFAULT_GAME, ctx(), false)).toEqual([]);
    const earned = earnedAchievements(
      { ...DEFAULT_GAME, xp: xpForLevel(5), activeDays: ["2026-10-01"] },
      ctx({ streak: 30, entries: 120, recipes: 1, customFoods: 2, weighIns: 4, scanned: true, atTargetWeight: true }),
      true,
    );
    expect(earned.sort()).toEqual(
      ["entries-100", "first-custom-food", "first-entry", "first-recipe", "first-scan", "first-weight", "level-5", "streak-30", "streak-7", "target-weight", "week-complete"].sort(),
    );
  });

  it("el peso objetivo cuenta al llegar o pasarlo en la dirección del plan", () => {
    expect(reachedTarget({ goal: "perder", targetWeightKg: 76 }, 76.1)).toBe(true);
    expect(reachedTarget({ goal: "perder", targetWeightKg: 76 }, 74)).toBe(true);
    expect(reachedTarget({ goal: "perder", targetWeightKg: 76 }, 77)).toBe(false);
    expect(reachedTarget({ goal: "ganar", targetWeightKg: 80 }, 81)).toBe(true);
    expect(reachedTarget({ goal: "ganar", targetWeightKg: 80 }, 78)).toBe(false);
    expect(reachedTarget({ goal: "mantener", targetWeightKg: 75 }, 76)).toBe(false);
    expect(reachedTarget({ goal: "perder", targetWeightKg: undefined }, 70)).toBe(false);
    expect(reachedTarget({ goal: "perder", targetWeightKg: 76 }, undefined)).toBe(false);
  });
});

describe("syncGame", () => {
  const full = Array.from({ length: 7 }, (_, i) => day(`2026-${i < 3 ? "09" : "10"}-${String(i < 3 ? 28 + i : i - 2).padStart(2, "0")}`, 2000, 150));
  const weeks = (entries: DiaryEntry[], weighIns = 0): Week[] => [{ start: MONDAY, quests: week(entries, weighIns) }];

  it("da la XP de las semanales completadas y desbloquea logros, con su fecha", () => {
    const r = syncGame({ ...DEFAULT_GAME, activeDays: ["2026-10-02"] }, "2026-10-02", weeks(full, 3), ctx({ entries: 7, weighIns: 3 }), NOW);
    expect(r.weeklyDone.map((q) => q.id)).toEqual(["kcal5", "protein5", "log7", "weigh3"]);
    expect(r.unlocked.map((a) => a.id)).toEqual(["first-entry", "first-weight", "week-complete"]);
    expect(r.gained).toBe(150 + 150 + 100 + 75 + 50 + 50 + 200);
    expect(r.state.xp).toBe(r.gained);
    expect(r.state.achievements).toEqual({ "first-entry": NOW, "first-weight": NOW, "week-complete": NOW });
    expect(r.state.awarded).toContain("2026-09-28:w:kcal5");
    expect(r.state.awarded).toContain("logro:week-complete");
    expect(r.levelUp).toBe(3);
  });

  it("no repite nada al volver a pasar", () => {
    const first = syncGame({ ...DEFAULT_GAME, activeDays: ["2026-10-02"] }, "2026-10-02", weeks(full, 3), ctx({ entries: 7, weighIns: 3 }), NOW);
    const again = syncGame(first.state, "2026-10-03", weeks(full, 3), ctx({ entries: 7, weighIns: 3 }), "2026-10-03T10:00:00.000Z");
    expect(again).toMatchObject({ gained: 0, levelUp: null, weeklyDone: [], unlocked: [] });
    expect(again.state).toBe(first.state);
  });

  it("la XP de una semanal puede dar el logro de nivel en la misma pasada", () => {
    const almost = { ...DEFAULT_GAME, xp: xpForLevel(5) - 100, activeDays: ["2026-10-02"], achievements: { "first-entry": NOW } };
    const r = syncGame(almost, "2026-10-02", weeks(full.slice(0, 5)), ctx({ entries: 5 }), NOW);
    expect(r.weeklyDone.map((q) => q.id)).toEqual(["kcal5", "protein5"]);
    expect(r.unlocked.map((a) => a.id)).toEqual(["level-5"]);
    expect(r.levelUp).toBe(5);
  });

  it("nunca quita XP ni logros aunque dejen de cumplirse las condiciones", () => {
    const before = { ...DEFAULT_GAME, xp: 900, awarded: ["2026-09-28:w:kcal5", "logro:streak-7"], achievements: { "streak-7": NOW } };
    const r = syncGame(before, "2026-10-02", weeks([]), ctx({ streak: 0 }), NOW);
    expect(r.state).toBe(before);
  });

  it("si otro dispositivo ya dio la recompensa de un logro, aquí solo se apunta", () => {
    const before = { ...DEFAULT_GAME, xp: 50, activeDays: ["2026-10-02"], awarded: ["logro:first-entry"] };
    const r = syncGame(before, "2026-10-02", weeks([]), ctx({ entries: 1 }), NOW);
    expect(r.gained).toBe(0);
    expect(r.state.xp).toBe(50);
    expect(r.state.achievements).toEqual({ "first-entry": NOW });
  });
});

describe("esquema v4: logros en el estado de juego", () => {
  it("un juego guardado antes de los logros se lee con la lista vacía y sin perder nada", () => {
    const v3 = { xp: 320, activeDays: ["2026-09-30"], awarded: ["2026-09-30:streak"], history: [{ date: "2026-09-30", xp: 320, level: 2 }] };
    expect(normalizeGame(v3)).toEqual({ ...v3, achievements: {} });
    const imported = parseImport({ app: "macro-quest", schema: 3, data: { game: v3 } }, NOW);
    expect(imported.game).toEqual({ ...v3, achievements: {} });
    expect(SCHEMA_VERSION).toBe(4);
  });
  it("conserva los logros guardados y descarta valores corruptos", () => {
    expect(normalizeGame({ xp: 10, achievements: { "streak-7": NOW, roto: 5, vacio: "" } }).achievements).toEqual({ "streak-7": NOW });
    expect(normalizeGame({ xp: 10, achievements: ["x"] }).achievements).toEqual({});
  });
});
