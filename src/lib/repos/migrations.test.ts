import { describe, expect, it } from "vitest";
import { fromLegacy, ImportError, LEGACY_PREFIX, parseImport, SCHEMA_VERSION, type ExportFile } from "./migrations";

const NOW = "2026-09-30T10:00:00.000Z";

/** Datos tal y como los guardaba la versión con localStorage. */
const legacy: Record<string, unknown> = {
  diary: [
    { id: "a", date: "2026-09-29", meal: "desayuno", name: "Avena", grams: 60, per100g: { kcal: 370, protein: 13, carbs: 60, fat: 7 }, foodId: "off:1" },
    { id: "b", date: "2026-09-29", meal: "comida", name: "Lentejas", grams: 350, per100g: { kcal: 120, protein: 8, carbs: 15, fat: 3 }, recipeId: "r1", foodId: "recipe:r1" },
    { id: "c", date: "2026-09-30", meal: "desayuno", name: "Roto", grams: 0, per100g: { kcal: 1, protein: 0, carbs: 0, fat: 0 } },
    { id: "d", date: "no-es-fecha", meal: "cena", name: "Mal", grams: 10, per100g: { kcal: 1, protein: 0, carbs: 0, fat: 0 } },
    { id: "e", date: "2026-09-30", meal: "rara", name: "Yogur", grams: 125, per100g: { kcal: 60, protein: 10, carbs: 4, fat: 0 } },
  ],
  custom: [{ id: "custom:1", name: "Mi pan", per100g: { kcal: 250, protein: 9, carbs: 48, fat: 2 }, custom: true }],
  recipes: [{ id: "r1", name: "Lentejas", ingredients: [{ id: "i1", name: "Lenteja", grams: 200, per100g: { kcal: 350, protein: 24, carbs: 50, fat: 1 } }], cookedWeight: 600, createdAt: "2026-09-01T00:00:00.000Z" }],
  weights: [{ date: "2026-09-29", kg: 81.2 }, { date: "2026-09-30", kg: -1 }],
  recents: [{ id: "off:1", name: "Avena", per100g: { kcal: 370, protein: 13, carbs: 60, fat: 7 } }],
  favorites: [],
  profile: { sex: "hombre", age: 33, heightCm: 180, weightKg: 81, activity: "moderado", goal: "perder", adjustPct: 15, proteinPerKg: 2, fatPct: 25 },
  game: { xp: 1234, streak: 5, lastActiveDate: "2026-09-29", awarded: ["2026-09-29:entry:0"], history: [{ date: "2026-09-28", xp: 1000, level: 3 }] },
};

describe("fromLegacy", () => {
  const s = fromLegacy((k) => legacy[k], NOW);

  it("conserva entradas válidas y descarta solo las corruptas", () => {
    expect(s.diary.map((e) => e.id)).toEqual(["a", "b", "e"]);
  });
  it("deduce el tipo de entrada y rellena marcas de tiempo", () => {
    expect(s.diary.find((e) => e.id === "a")!.kind).toBe("food");
    expect(s.diary.find((e) => e.id === "b")!.kind).toBe("recipe");
    expect(s.diary.every((e) => e.updatedAt === NOW && e.createdAt)).toBe(true);
  });
  it("mantiene el orden original mediante createdAt", () => {
    const sorted = [...s.diary].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((e) => e.id);
    expect(sorted).toEqual(["a", "b", "e"]);
  });
  it("una comida desconocida no pierde la entrada", () => {
    expect(s.diary.find((e) => e.id === "e")!.meal).toBe("snacks");
  });
  it("migra alimentos, recetas, pesos, perfil y recientes", () => {
    expect(s.foods).toHaveLength(1);
    expect(s.foods[0]!.custom).toBe(true);
    expect(s.recipes[0]!.updatedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(s.weights).toEqual([{ date: "2026-09-29", kg: 81.2, updatedAt: NOW }]);
    expect(s.profile.heightCm).toBe(180);
    expect(s.recents).toHaveLength(1);
  });
  it("conserva la XP y reconstruye los días activos desde el diario", () => {
    expect(s.game.xp).toBe(1234);
    expect(s.game.awarded).toEqual(["2026-09-29:entry:0"]);
    expect(s.game.activeDays).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
  });
  it("sin datos devuelve valores por defecto", () => {
    const empty = fromLegacy(() => undefined, NOW);
    expect(empty.diary).toEqual([]);
    expect(empty.game.xp).toBe(0);
    expect(empty.settings.hiddenMeals).toEqual([]);
  });
});

describe("parseImport", () => {
  it("acepta el formato antiguo con prefijo", () => {
    const file = Object.fromEntries(Object.entries(legacy).map(([k, v]) => [LEGACY_PREFIX + k, v]));
    expect(parseImport(file, NOW).diary).toHaveLength(3);
  });

  it("ida y vuelta con el formato actual", () => {
    const data = fromLegacy((k) => legacy[k], NOW);
    const file: ExportFile = { app: "macro-quest", schema: SCHEMA_VERSION, exportedAt: NOW, data };
    expect(parseImport(JSON.parse(JSON.stringify(file)), NOW)).toEqual(data);
  });

  it("rechaza archivos ajenos o de una versión futura", () => {
    expect(() => parseImport([], NOW)).toThrow(ImportError);
    expect(() => parseImport({ foo: 1 }, NOW)).toThrow(ImportError);
    expect(() => parseImport({ app: "macro-quest", schema: SCHEMA_VERSION + 1, data: {} }, NOW)).toThrow(ImportError);
  });
});
