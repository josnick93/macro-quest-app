import { describe, expect, it } from "vitest";
import {
  fromLegacy,
  ImportError,
  LEGACY_PREFIX,
  normalizeFavorites,
  normalizeGame,
  normalizeProfile,
  normalizeRecord,
  normalizeSettings,
  parseImport,
  SCHEMA_VERSION,
  type ExportFile,
} from "./migrations";
import { calcTargets, formulaTDEE } from "../nutrition";

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
    // El propio + la avena de recientes (pasa a historial)
    expect(s.foods.map((f) => [f.id, f.source])).toEqual([
      ["custom:1", "custom"],
      ["off:1", "off"],
    ]);
    expect(s.recipes[0]!.updatedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(s.weights).toEqual([{ date: "2026-09-29", kg: 81.2, updatedAt: NOW }]);
    expect(s.profile.heightCm).toBe(180);
    expect(s.favorites).toEqual([]);
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

describe("v1 → v2", () => {
  const v1 = {
    diary: [],
    foods: [{ id: "custom:1", name: "Mi pan", per100g: { kcal: 250, protein: 9, carbs: 48, fat: 2 }, custom: true, updatedAt: "2026-09-01T00:00:00.000Z" }],
    recents: [
      { id: "off:1", name: "Avena", per100g: { kcal: 370, protein: 13, carbs: 60, fat: 7 } },
      // versión antigua del propio en recientes: no debe pisar la del almacén
      { id: "custom:1", name: "Pan viejo", per100g: { kcal: 1, protein: 0, carbs: 0, fat: 0 }, custom: true },
    ],
    favorites: [
      { id: "off:2", name: "Skyr", per100g: { kcal: 60, protein: 10, carbs: 4, fat: 0 } },
      { id: "recipe:r1", name: "Lentejas", per100g: { kcal: 120, protein: 8, carbs: 15, fat: 3 } },
    ],
  };

  it("unifica alimentos, convierte favoritos a ids y no guarda recetas como alimento", () => {
    const s = parseImport({ app: "macro-quest", schema: 1, exportedAt: NOW, data: v1 }, NOW);
    expect(s.foods.map((f) => f.id).sort()).toEqual(["custom:1", "off:1", "off:2"]);
    expect(s.foods.find((f) => f.id === "custom:1")!.name).toBe("Mi pan");
    expect(s.favorites).toEqual(["off:2", "recipe:r1"]);
    expect(s.savedMeals).toEqual([]);
  });

  it("conserva micros y raciones válidos y descarta los inválidos", () => {
    const s = parseImport(
      {
        app: "macro-quest",
        schema: 2,
        data: {
          foods: [
            {
              id: "custom:2",
              name: "Yogur",
              source: "custom",
              per100g: { kcal: 60, protein: 10, carbs: 4, fat: 0, fiber: 0, sugar: 4, salt: -1 },
              servings: [{ label: "1 yogur", grams: 125 }, { label: "", grams: 10 }, { label: "mal", grams: 0 }],
            },
          ],
        },
      },
      NOW,
    );
    const f = s.foods[0]!;
    expect(f.per100g).toEqual({ kcal: 60, protein: 10, carbs: 4, fat: 0, fiber: 0, sugar: 4 });
    expect(f.servings).toEqual([{ label: "1 yogur", grams: 125 }]);
  });

  it("comidas guardadas: descarta las vacías", () => {
    const item = { kind: "food", name: "Avena", grams: 60, per100g: { kcal: 370, protein: 13, carbs: 60, fat: 7 }, foodId: "off:1" };
    const s = parseImport(
      { app: "macro-quest", schema: 2, data: { savedMeals: [{ id: "m1", name: "Desayuno", items: [item] }, { id: "m2", name: "Vacía", items: [] }] } },
      NOW,
    );
    expect(s.savedMeals.map((m) => m.id)).toEqual(["m1"]);
    expect(s.savedMeals[0]!.items[0]!.grams).toBe(60);
  });
});

describe("v2 → v3", () => {
  const v2 = { sex: "hombre", age: 33, heightCm: 180, weightKg: 81, activity: "moderado", goal: "perder", adjustPct: 15, proteinPerKg: 2, fatPct: 25 };

  it("el % de déficit pasa a kg/semana conservando las kcal objetivo", () => {
    const p = normalizeProfile(v2);
    expect(p).not.toHaveProperty("adjustPct");
    expect(p.rateKgWeek).toBeGreaterThan(0);
    const before = formulaTDEE(p) * 0.85;
    expect(Math.abs(calcTargets(p).kcal - before)).toBeLessThan(8);
  });

  it("importar una copia v2 migra el perfil y no toca el resto", () => {
    const s = parseImport({ app: "macro-quest", schema: 2, data: { profile: v2, weights: [{ date: "2026-09-29", kg: 81 }] } }, NOW);
    expect(s.profile.rateKgWeek).toBe(normalizeProfile(v2).rateKgWeek);
    expect(s.profile.heightCm).toBe(180);
    expect(s.weights).toHaveLength(1);
  });

  it("un perfil v3 se conserva tal cual, con sus campos opcionales", () => {
    const v3 = { ...normalizeProfile(v2), rateKgWeek: 0.25, bodyFatPct: 18, neckCm: 38, waistCm: 86, targetWeightKg: 76, tdeeOverride: 2800, weekdayKcal: [0, 0, 0, 0, 0, 200, 0] };
    expect(normalizeProfile(JSON.parse(JSON.stringify(v3)))).toEqual(v3);
  });

  it("descarta opcionales inválidos sin perder el perfil", () => {
    const p = normalizeProfile({ ...v2, bodyFatPct: -3, waistCm: "ancha", weekdayKcal: [1, 2], tdeeOverride: 0 });
    expect(p.bodyFatPct).toBeUndefined();
    expect(p.waistCm).toBeUndefined();
    expect(p.weekdayKcal).toBeUndefined();
    expect(p.tdeeOverride).toBeUndefined();
    expect(p.weightKg).toBe(81);
  });
});

describe("registros llegados de la sincronización", () => {
  const per100g = { kcal: 100, protein: 10, carbs: 5, fat: 2 };
  it("valida cada tipo y devuelve su clave", () => {
    const e = normalizeRecord("diary", { id: "a", date: "2026-10-02", meal: "cena", kind: "food", name: "Arroz", grams: 80, per100g, createdAt: NOW, updatedAt: NOW });
    expect(e).toMatchObject({ key: "a", value: { name: "Arroz", meal: "cena" } });
    expect(normalizeRecord("weights", { date: "2026-10-02", kg: 80.5, updatedAt: NOW })).toEqual({ key: "2026-10-02", value: { date: "2026-10-02", kg: 80.5, updatedAt: NOW } });
    expect(normalizeRecord("notes", { date: "2026-10-02", text: "bien", updatedAt: NOW })?.key).toBe("2026-10-02");
    expect(normalizeRecord("foods", { id: "custom:1", name: "Pan", per100g, source: "custom" })?.key).toBe("custom:1");
    expect(normalizeRecord("recipes", { id: "r1", name: "Guiso", ingredients: [], cookedWeight: 500 })?.key).toBe("r1");
    expect(normalizeRecord("savedMeals", { id: "m1", name: "Desayuno", items: [{ name: "Avena", grams: 60, per100g }] })?.key).toBe("m1");
  });
  it("una entrada sin fecha de creación usa la de su última edición, para no quedar sin orden", () => {
    const e = normalizeRecord("diary", { id: "a", date: "2026-10-02", meal: "cena", name: "Arroz", grams: 80, per100g, updatedAt: NOW });
    expect(e?.value).toMatchObject({ createdAt: NOW, kind: "food" });
  });
  it("descarta lo corrupto en vez de guardarlo", () => {
    expect(normalizeRecord("diary", { id: "a", date: "mal", name: "x", grams: 1, per100g })).toBeNull();
    expect(normalizeRecord("diary", { id: "a", date: "2026-10-02", name: "x", grams: 0, per100g })).toBeNull();
    expect(normalizeRecord("weights", { date: "2026-10-02", kg: -3 })).toBeNull();
    expect(normalizeRecord("foods", { id: "recipe:r1", name: "Guiso", per100g, source: "recipe" })).toBeNull();
    expect(normalizeRecord("savedMeals", { id: "m1", name: "Vacía", items: [] })).toBeNull();
    expect(normalizeRecord("recipes", "texto")).toBeNull();
  });
  it("ajustes, favoritos y juego se validan igual", () => {
    expect(normalizeSettings({ hiddenMeals: ["cena", "inventada"] })).toEqual({ hiddenMeals: ["cena"] });
    expect(normalizeFavorites(["a", "a", 3, "", "b"])).toEqual(["a", "b"]);
    expect(normalizeGame({ xp: -5, awarded: ["k", 1], activeDays: ["2026-10-02", "mal"] })).toEqual({ xp: 0, activeDays: ["2026-10-02"], awarded: ["k"], history: [], achievements: {} });
  });
});
