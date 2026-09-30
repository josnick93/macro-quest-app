import { describe, expect, it } from "vitest";
import { calcBMR, calcTargets, recipePer100g } from "./nutrition";
import { DEFAULT_PROFILE } from "./repos/migrations";

describe("objetivos", () => {
  it("Mifflin-St Jeor", () => {
    expect(calcBMR({ ...DEFAULT_PROFILE, sex: "hombre", weightKg: 80, heightCm: 178, age: 33 })).toBeCloseTo(1752.5);
    expect(calcBMR({ ...DEFAULT_PROFILE, sex: "mujer", weightKg: 60, heightCm: 165, age: 30 })).toBeCloseTo(1320.25);
  });
  it("los macros suman aproximadamente las kcal objetivo", () => {
    const t = calcTargets(DEFAULT_PROFILE);
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThan(10);
  });
});

describe("recetas", () => {
  it("macros por 100 g usan el peso cocinado", () => {
    const r = recipePer100g({ cookedWeight: 400, ingredients: [{ id: "1", name: "Arroz", grams: 200, per100g: { kcal: 350, protein: 7, carbs: 78, fat: 1 } }] });
    expect(r.kcal).toBeCloseTo(175);
  });
});
