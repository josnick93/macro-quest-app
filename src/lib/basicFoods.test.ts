import { describe, expect, it } from "vitest";
import { BASIC_CATEGORY, BASIC_FOODS, BASIC_PREFIX, withBasics } from "./basicFoods";
import { mergeSearch } from "./foods";
import { parseImport, SCHEMA_VERSION } from "./repos/migrations";
import type { Food } from "./types";

/** Bebidas con alcohol: su energía no sale solo de los macros (7 kcal/g de alcohol). */
const ALCOHOL = new Set(["base:cerveza", "base:vino-tinto"]);

describe("alimentos básicos", () => {
  it("ids únicos, con prefijo y categoría", () => {
    const ids = BASIC_FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith(BASIC_PREFIX) && /^base:[a-z0-9-]+$/.test(id))).toBe(true);
    expect(BASIC_FOODS.every((f) => BASIC_CATEGORY.has(f.id))).toBe(true);
    expect(BASIC_FOODS.length).toBeGreaterThan(100);
  });

  it("las kcal cuadran con los macros (detecta erratas en la tabla)", () => {
    const off = BASIC_FOODS.filter((f) => !ALCOHOL.has(f.id)).flatMap((f) => {
      const p = f.per100g;
      const est = 4 * p.protein + 4 * p.carbs + 9 * p.fat + 2 * (p.fiber ?? 0);
      const diff = Math.abs(est - p.kcal);
      return diff > Math.max(12, p.kcal * 0.12) ? [`${f.name}: ${p.kcal} kcal vs ${Math.round(est)}`] : [];
    });
    expect(off).toEqual([]);
  });

  it("valores con sentido: macros dentro de 100 g y micros no mayores que su macro", () => {
    const bad = BASIC_FOODS.flatMap((f) => {
      const p = f.per100g;
      const issues = [
        p.protein + p.carbs + p.fat + (p.fiber ?? 0) > 101 && "macros > 100 g",
        (p.sugar ?? 0) > p.carbs && "azúcares > hidratos",
        (p.satFat ?? 0) > p.fat && "saturada > grasa",
        (f.servings ?? []).some((s) => !(s.grams > 0)) && "ración sin gramos",
      ].filter(Boolean);
      return issues.length ? [`${f.name}: ${issues.join(", ")}`] : [];
    });
    expect(bad).toEqual([]);
  });

  it("una corrección del usuario sustituye al básico; una copia sin corregir no", () => {
    const apple = BASIC_FOODS.find((f) => f.id === "base:manzana")!;
    const pear = BASIC_FOODS.find((f) => f.id === "base:pera")!;
    const mine: Food = { id: "custom:1", name: "Mi pan", per100g: { kcal: 250, protein: 8, carbs: 50, fat: 2 }, source: "custom" };
    const stored: Food[] = [
      mine,
      { ...apple, per100g: { ...apple.per100g, kcal: 60 }, edited: true },
      { ...pear, per100g: { ...pear.per100g, kcal: 999 } }, // copia vieja guardada al marcar favorito
    ];
    const all = withBasics(stored);
    expect(all.filter((f) => f.id === "base:manzana")).toHaveLength(1);
    expect(all.find((f) => f.id === "base:manzana")!.per100g.kcal).toBe(60);
    expect(all.find((f) => f.id === "base:pera")!.per100g.kcal).toBe(pear.per100g.kcal);
    expect(all.filter((f) => f.source === "basic")).toHaveLength(BASIC_FOODS.length);
    expect(all).toContain(mine);
  });

  it("en la búsqueda van tras mis alimentos y antes de Open Food Facts; los ya usados, en el historial", () => {
    const local = withBasics([{ id: "custom:1", name: "Pera al vino", per100g: { kcal: 90, protein: 0, carbs: 20, fat: 0 }, source: "custom" }]);
    const remote: Food[] = [{ id: "off:1", name: "Pera en almíbar", per100g: { kcal: 70, protein: 0, carbs: 17, fat: 0 }, source: "off" }];
    const r = mergeSearch("pera", local, remote);
    expect(r.map((x) => [x.food.id, x.group])).toEqual([
      ["custom:1", "mine"],
      ["base:pera", "basic"],
      ["off:1", "off"],
    ]);
    expect(mergeSearch("pera", local, [], { "base:pera": 3 }).find((x) => x.food.id === "base:pera")!.group).toBe("history");
  });

  it("lo que empieza por la búsqueda va primero", () => {
    const r = mergeSearch("tomate", withBasics([]), []).map((x) => x.food.name);
    expect(r[0]).toBe("Tomate");
  });

  it("una corrección de un básico sobrevive a exportar/importar", () => {
    const apple = BASIC_FOODS.find((f) => f.id === "base:manzana")!;
    const snap = parseImport({
      app: "macro-quest",
      schema: SCHEMA_VERSION,
      exportedAt: "2026-10-15T00:00:00Z",
      data: { foods: [{ ...apple, edited: true, updatedAt: "2026-10-15T00:00:00Z" }] },
    });
    expect(snap.foods[0]).toMatchObject({ id: "base:manzana", source: "basic", edited: true });
    // Sin `source` (versión antigua), el prefijo basta.
    const old = parseImport({ app: "macro-quest", schema: SCHEMA_VERSION, exportedAt: "", data: { foods: [{ id: "base:pera", name: "Pera", per100g: apple.per100g }] } });
    expect(old.foods[0]!.source).toBe("basic");
  });
});
