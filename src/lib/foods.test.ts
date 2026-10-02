import { describe, expect, it } from "vitest";
import { defaultQuantity, foodStats, formatQuantity, matchesQuery, mergeSearch, quantityGrams, recipeAsFood, resolveFoods, knownFoods } from "./foods";
import type { DiaryEntry, Food } from "./types";

const per100g = { kcal: 100, protein: 10, carbs: 10, fat: 1 };
const food = (id: string, name: string, source: Food["source"] = "off", extra: Partial<Food> = {}): Food => ({ id, name, per100g, source, ...extra });

let seq = 0;
const entry = (foodId: string | undefined, date: string, grams: number, kind: DiaryEntry["kind"] = "food"): DiaryEntry => ({
  id: `e${++seq}`,
  date,
  meal: "comida",
  kind,
  name: foodId ?? "rápido",
  grams,
  per100g,
  foodId,
  createdAt: `${date}T10:00:00.${String(seq).padStart(3, "0")}Z`,
  updatedAt: "",
});

describe("foodStats", () => {
  const entries = [
    entry("off:avena", "2026-09-28", 60),
    entry("off:pollo", "2026-09-29", 200),
    entry("off:avena", "2026-09-29", 50),
    entry("off:avena", "2026-09-30", 70),
    entry("off:skyr", "2026-09-30", 150),
    entry(undefined, "2026-09-30", 100, "quick"),
  ];
  const s = foodStats(entries);

  it("recientes por último uso, sin añadidos rápidos", () => {
    expect(s.recents).toEqual(["off:skyr", "off:avena", "off:pollo"]);
  });
  it("frecuentes por número de usos", () => {
    expect(s.frequent[0]).toBe("off:avena");
    expect(s.count["off:avena"]).toBe(3);
  });
  it("última cantidad usada", () => {
    expect(s.lastGrams["off:avena"]).toBe(70);
  });
  it("resuelve alimentos que ya no están en el almacén desde el diario", () => {
    const foods = resolveFoods(["off:pollo", "off:nada"], new Map(), s.lastEntry);
    expect(foods).toHaveLength(1);
    expect(foods[0]!.name).toBe("off:pollo");
  });
});

describe("cantidades", () => {
  const yogur = food("custom:y", "Yogur", "custom", { servings: [{ label: "1 yogur", grams: 125 }] });

  it("sin historial: primera ración; sin raciones: 100 g", () => {
    expect(formatQuantity(defaultQuantity(yogur))).toBe("1 × 1 yogur");
    expect(quantityGrams(defaultQuantity(food("a", "a")))).toBe(100);
  });
  it("un envase familiar no es la ración por defecto", () => {
    const arroz = food("a", "Arroz", "off", { servings: [{ label: "envase", grams: 1000 }] });
    expect(formatQuantity(defaultQuantity(arroz))).toBe("100 g");
    const galletas = food("g", "Galletas", "off", { servings: [{ label: "envase", grams: 800 }, { label: "ración 30 g", grams: 30 }] });
    expect(quantityGrams(defaultQuantity(galletas))).toBe(30);
  });
  it("la última cantidad se expresa en raciones si encaja", () => {
    expect(formatQuantity(defaultQuantity(yogur, 250))).toBe("2 × 1 yogur");
    expect(formatQuantity(defaultQuantity(yogur, 90))).toBe("90 g");
  });
  it("gramos de una ración", () => {
    expect(quantityGrams({ unit: { label: "rebanada", grams: 30 }, amount: 1.5 })).toBe(45);
  });
});

describe("búsqueda", () => {
  it("ignora tildes, mayúsculas y orden de palabras", () => {
    expect(matchesQuery({ name: "Plátano de Canarias" }, "platano canarias")).toBe(true);
    expect(matchesQuery({ name: "Yogur griego", brand: "Hacendado" }, "HACENDADO yogur")).toBe(true);
    expect(matchesQuery({ name: "Yogur" }, "leche")).toBe(false);
  });

  it("orden: mis alimentos → recetas → historial → OFF, sin duplicados y con la versión local", () => {
    const local = [
      food("off:1", "Yogur natural", "off", { edited: true, per100g: { ...per100g, kcal: 55 } }),
      food("custom:1", "Yogur casero", "custom"),
      recipeAsFood({ id: "r1", name: "Yogur con fruta", ingredients: [{ id: "i", name: "x", grams: 100, per100g }], cookedWeight: 0, createdAt: "" }),
    ];
    const remote = [food("off:1", "Yogur natural"), food("off:2", "Yogur griego")];
    const r = mergeSearch("yogur", local, remote);
    expect(r.map((x) => [x.food.id, x.group])).toEqual([
      ["custom:1", "mine"],
      ["recipe:r1", "recipes"],
      ["off:1", "history"],
      ["off:2", "off"],
    ]);
    expect(r[2]!.food.per100g.kcal).toBe(55);
  });

  it("dentro de un grupo, primero lo más usado", () => {
    const local = [food("off:a", "Arroz blanco"), food("off:b", "Arroz integral")];
    expect(mergeSearch("arroz", local, [], { "off:b": 5 }).map((x) => x.food.id)).toEqual(["off:b", "off:a"]);
  });
});

describe("recetas como alimento", () => {
  it("ofrece ración y receta entera", () => {
    const f = recipeAsFood({ id: "r", name: "Lentejas", ingredients: [{ id: "i", name: "x", grams: 300, per100g }], cookedWeight: 800, servings: 4, createdAt: "" });
    expect(f.servings).toEqual([
      { label: "ración", grams: 200 },
      { label: "receta entera", grams: 800 },
    ]);
    expect(knownFoods([], [{ id: "r", name: "L", ingredients: [], cookedWeight: 0, createdAt: "" }]).has("recipe:r")).toBe(true);
  });
});
