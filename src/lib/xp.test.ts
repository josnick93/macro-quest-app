import { describe, expect, it } from "vitest";
import { awardXp, dailyQuests, grantAwards, levelFromXp, MAX_AWARDED, mergeGame, shieldedStreak, syncDayXp, weekStartISO, xpForLevel } from "./xp";
import type { GameState } from "./types";
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

describe("racha con escudo", () => {
  // El 28 de septiembre de 2026 es lunes.
  const streak = (days: string[], today: string) => shieldedStreak(days, today);

  it("cuenta días seguidos hasta hoy y cruza meses", () => {
    expect(streak(["2026-09-28", "2026-09-29", "2026-09-30"], "2026-09-30")).toEqual({ streak: 3, shieldReady: true, forgiven: [] });
    expect(streak(["2026-08-31", "2026-09-01"], "2026-09-01").streak).toBe(2);
    expect(weekStartISO("2026-10-04")).toBe("2026-09-28");
  });
  it("si hoy aún no hay registro, ni rompe la racha ni gasta el escudo", () => {
    expect(streak(["2026-09-28", "2026-09-29"], "2026-09-30")).toEqual({ streak: 2, shieldReady: true, forgiven: [] });
  });
  it("perdona un día sin registro por semana; el día perdonado no suma", () => {
    expect(streak(["2026-09-28", "2026-09-30"], "2026-09-30")).toEqual({ streak: 2, shieldReady: false, forgiven: ["2026-09-29"] });
    // El hueco fue la semana pasada: el escudo de esta sigue disponible.
    expect(streak(["2026-09-26", "2026-09-28", "2026-09-29"], "2026-09-29")).toEqual({ streak: 3, shieldReady: true, forgiven: ["2026-09-27"] });
    // Ayer no registró y hoy todavía tampoco.
    expect(streak(["2026-09-28"], "2026-09-30")).toEqual({ streak: 1, shieldReady: false, forgiven: ["2026-09-29"] });
  });
  it("dos días sin registro en la misma semana sí la rompen", () => {
    expect(streak(["2026-09-28", "2026-10-01"], "2026-10-01")).toEqual({ streak: 1, shieldReady: true, forgiven: [] });
    expect(streak(["2026-09-20", "2026-09-21"], "2026-09-30")).toEqual({ streak: 0, shieldReady: true, forgiven: [] });
    expect(streak([], "2026-09-30").streak).toBe(0);
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

describe("unir el juego de dos dispositivos", () => {
  const base: GameState = { xp: 100, activeDays: ["2026-10-01"], awarded: ["2026-10-01:entry:0", "2026-10-01:streak"], history: [{ date: "2026-10-01", xp: 100, level: 1 }], achievements: {} };
  const give = (g: GameState, day: string, keys: string[]): GameState => ({
    xp: g.xp + keys.reduce((a, k) => a + awardXp(`${day}:${k}`), 0),
    activeDays: [...new Set([...g.activeDays, day])],
    awarded: [...g.awarded, ...keys.map((k) => `${day}:${k}`)],
    history: [...g.history.filter((h) => h.date !== day), { date: day, xp: g.xp + keys.reduce((a, k) => a + awardXp(`${day}:${k}`), 0), level: 1 }],
    achievements: g.achievements,
  });

  it("sabe cuánto vale cada recompensa", () => {
    expect(awardXp("2026-10-02:entry:3")).toBe(10);
    expect(awardXp("2026-10-02:streak")).toBe(15);
    expect(awardXp("2026-10-02:protein")).toBe(60);
    expect(awardXp("2026-10-02:desconocida")).toBe(0);
  });

  it("suma lo ganado en cada uno sin contar dos veces lo común", () => {
    const phone = give(base, "2026-10-02", ["entry:0", "streak", "protein"]); // +85
    const laptop = give(base, "2026-10-02", ["entry:0", "streak", "meals3"]); // +65, comparte 25
    const merged = mergeGame(phone, laptop);
    expect(merged.xp).toBe(100 + 10 + 15 + 60 + 40);
    expect(merged.awarded).toHaveLength(6);
    expect(merged.activeDays).toEqual(["2026-10-01", "2026-10-02"]);
    expect(merged.history.find((h) => h.date === "2026-10-02")?.xp).toBe(185);
  });

  it("no depende del orden, es estable y nunca baja la XP de ninguno", () => {
    const phone = give(base, "2026-10-02", ["entry:0", "kcal"]);
    const laptop = give(base, "2026-10-03", ["entry:0", "streak"]);
    const merged = mergeGame(phone, laptop);
    expect(mergeGame(laptop, phone)).toEqual(merged);
    expect(mergeGame(merged, phone)).toEqual(merged);
    expect(mergeGame(merged, merged)).toEqual(merged);
    expect(merged.xp).toBeGreaterThanOrEqual(Math.max(phone.xp, laptop.xp));
    // Un dispositivo sin nada (recién instalado) recibe todo.
    expect(mergeGame(DEFAULT_GAME, phone).xp).toBe(phone.xp);
  });

  it("no vuelve a sumar recompensas antiguas que un dispositivo ya contó y olvidó", () => {
    const full: GameState = {
      xp: 50_000,
      activeDays: [],
      awarded: Array.from({ length: MAX_AWARDED }, (_, i) => `2026-06-01:entry:${String(i).padStart(5, "0")}`),
      history: [],
      achievements: {},
    };
    const stale: GameState = { xp: 500, activeDays: [], awarded: ["2025-01-01:protein", "2025-01-01:streak"], history: [], achievements: {} };
    expect(mergeGame(full, stale).xp).toBe(50_000);
  });
});

describe("recompensas sueltas (semanales y logros)", () => {
  it("valen lo que dice su clave", () => {
    expect(awardXp("2026-09-28:w:kcal5")).toBe(150);
    expect(awardXp("2026-09-28:w:weigh3")).toBe(75);
    expect(awardXp("logro:streak-7")).toBe(100);
    expect(awardXp("logro:inventado")).toBe(0);
  });
  it("se dan una sola vez y dejan el historial del día al día", () => {
    const first = grantAwards(DEFAULT_GAME, "2026-10-02", [{ key: "2026-09-28:w:kcal5", xp: 150 }, { key: "logro:first-entry", xp: 50 }]);
    expect(first.gained).toBe(200);
    expect(first.state.history).toEqual([{ date: "2026-10-02", xp: 200, level: 1 }]);
    const again = grantAwards(first.state, "2026-10-02", [{ key: "2026-09-28:w:kcal5", xp: 150 }]);
    expect(again.gained).toBe(0);
    expect(again.state).toBe(first.state);
    expect(grantAwards({ ...DEFAULT_GAME, xp: 240 }, "2026-10-02", [{ key: "logro:first-entry", xp: 50 }]).levelUp).toBe(2);
  });
  it("al unir dos dispositivos, un logro cuenta una vez y conserva su fecha más antigua", () => {
    const phone: GameState = { ...DEFAULT_GAME, xp: 150, awarded: ["logro:streak-7", "logro:first-entry"], achievements: { "streak-7": "2026-10-01T10:00:00.000Z", "first-entry": "2026-09-01T10:00:00.000Z" } };
    const laptop: GameState = { ...DEFAULT_GAME, xp: 100, awarded: ["logro:first-entry", "logro:first-recipe"], achievements: { "first-entry": "2026-09-05T10:00:00.000Z", "first-recipe": "2026-09-06T10:00:00.000Z" } };
    const merged = mergeGame(phone, laptop);
    expect(merged.xp).toBe(200);
    expect(merged.achievements).toEqual({
      "first-entry": "2026-09-01T10:00:00.000Z",
      "first-recipe": "2026-09-06T10:00:00.000Z",
      "streak-7": "2026-10-01T10:00:00.000Z",
    });
    expect(mergeGame(laptop, phone)).toEqual(merged);
    expect(mergeGame(merged, laptop)).toEqual(merged);
  });
});
