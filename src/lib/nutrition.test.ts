import { describe, expect, it } from "vitest";
import { calcBMR, calcTargets, calcTDEE, formulaTDEE, navyBodyFat, recipePer100g } from "./nutrition";
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

describe("composición corporal", () => {
  it("método de la Marina: hombre y mujer", () => {
    expect(navyBodyFat({ sex: "hombre", heightCm: 178, neckCm: 38, waistCm: 85 })).toBeCloseTo(16.4, 1);
    expect(navyBodyFat({ sex: "mujer", heightCm: 165, neckCm: 32, waistCm: 70, hipCm: 95 })).toBeCloseTo(24.9, 1);
  });
  it("sin medidas suficientes o incoherentes no inventa un valor", () => {
    expect(navyBodyFat({ sex: "hombre", heightCm: 178, waistCm: 85 })).toBeNull();
    expect(navyBodyFat({ sex: "mujer", heightCm: 165, neckCm: 32, waistCm: 70 })).toBeNull();
    expect(navyBodyFat({ sex: "hombre", heightCm: 178, neckCm: 90, waistCm: 85 })).toBeNull();
  });
  it("con % de grasa el basal usa Katch-McArdle", () => {
    expect(calcBMR({ ...DEFAULT_PROFILE, weightKg: 80, bodyFatPct: 20 })).toBeCloseTo(370 + 21.6 * 64);
  });
});

describe("plan", () => {
  const p = { ...DEFAULT_PROFILE, weightKg: 80, rateKgWeek: 0.5 };
  it("el ritmo en kg/semana se traduce en kcal al día", () => {
    const tdee = Math.round(formulaTDEE(p));
    expect(calcTargets({ ...p, goal: "perder" }).kcal).toBe(tdee - 550);
    expect(calcTargets({ ...p, goal: "ganar" }).kcal).toBe(tdee + 550);
    expect(calcTargets({ ...p, goal: "mantener" }).kcal).toBe(tdee);
  });
  it("el gasto medido sustituye al de la fórmula", () => {
    expect(calcTDEE({ ...p, tdeeOverride: 2900 })).toBe(2900);
    expect(calcTargets({ ...p, goal: "mantener", tdeeOverride: 2900 }).kcal).toBe(2900);
  });
  it("ajuste por día de la semana: solo con fecha y sin tocar la proteína", () => {
    const week = { ...p, goal: "mantener" as const, weekdayKcal: [0, 0, 0, 0, 0, 300, -100] };
    const base = calcTargets(week);
    const sat = calcTargets(week, "2026-10-03"); // sábado
    expect(sat.kcal).toBe(base.kcal + 300);
    expect(calcTargets(week, "2026-10-04").kcal).toBe(base.kcal - 100); // domingo
    expect(calcTargets(week, "2026-10-05").kcal).toBe(base.kcal); // lunes
    expect(sat.protein).toBe(base.protein);
  });
});

describe("recetas", () => {
  it("macros por 100 g usan el peso cocinado", () => {
    const r = recipePer100g({ cookedWeight: 400, ingredients: [{ id: "1", name: "Arroz", grams: 200, per100g: { kcal: 350, protein: 7, carbs: 78, fat: 1 } }] });
    expect(r.kcal).toBeCloseTo(175);
  });
});
