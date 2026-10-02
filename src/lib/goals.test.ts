import { describe, expect, it } from "vitest";
import { defaultRate, estimateTdee, kcalByDay, scenarios, targetWarnings, weeksToTarget } from "./goals";
import { DEFAULT_PROFILE } from "./repos/migrations";
import { addDaysISO } from "./date";
import type { DiaryEntry, Profile, WeightLog } from "./types";

const base: Profile = { ...DEFAULT_PROFILE, sex: "hombre", age: 33, heightCm: 178, weightKg: 80, activity: "moderado", goal: "perder", rateKgWeek: 0.4 };

describe("escenarios", () => {
  it("ritmo recomendado según el peso", () => {
    expect(defaultRate("perder", 80)).toBe(0.4);
    expect(defaultRate("ganar", 80)).toBe(0.2);
    expect(defaultRate("mantener", 80)).toBe(0);
  });
  it("definición < mantenimiento < volumen, y el activo usa el ritmo del perfil", () => {
    const [cut, keep, bulk] = scenarios({ ...base, rateKgWeek: 0.7 });
    expect(cut!.targets.kcal).toBeLessThan(keep!.targets.kcal);
    expect(keep!.targets.kcal).toBeLessThan(bulk!.targets.kcal);
    expect(cut).toMatchObject({ active: true, rateKgWeek: 0.7 });
    expect(bulk).toMatchObject({ active: false, rateKgWeek: 0.2 });
    expect(keep!.targets.kcal).toBe(keep!.targets.tdee);
  });
});

describe("avisos", () => {
  it("un plan razonable no avisa de nada", () => {
    expect(targetWarnings(base)).toEqual([]);
  });
  it("avisa de ritmo alto y de calorías demasiado bajas", () => {
    expect(targetWarnings({ ...base, rateKgWeek: 1 }).some((w) => w.includes("1 %"))).toBe(true);
    const low = targetWarnings({ ...base, sex: "mujer", weightKg: 50, heightCm: 155, activity: "sedentario", rateKgWeek: 0.5 });
    expect(low.some((w) => w.includes("1200"))).toBe(true);
    expect(targetWarnings({ ...base, goal: "ganar", rateKgWeek: 0.5 }).some((w) => w.includes("0,5 %"))).toBe(true);
  });
  it("avisa del déficit en menores, no del mantenimiento", () => {
    expect(targetWarnings({ ...base, age: 16 }).some((w) => w.includes("18 años"))).toBe(true);
    expect(targetWarnings({ ...base, age: 16, goal: "mantener" })).toEqual([]);
  });
  it("avisa si el peso objetivo contradice el objetivo o es demasiado bajo", () => {
    expect(targetWarnings({ ...base, targetWeightKg: 85 })).toHaveLength(1);
    expect(targetWarnings({ ...base, targetWeightKg: 55 }).some((w) => w.includes("IMC"))).toBe(true);
  });
});

describe("plazo", () => {
  it("semanas hasta el peso objetivo", () => {
    expect(weeksToTarget({ ...base, targetWeightKg: 76 })).toBeCloseTo(10);
    expect(weeksToTarget({ ...base, goal: "ganar", rateKgWeek: 0.2, targetWeightKg: 82 })).toBeCloseTo(10);
  });
  it("sin objetivo, en mantenimiento o en sentido contrario no hay plazo", () => {
    expect(weeksToTarget(base)).toBeNull();
    expect(weeksToTarget({ ...base, goal: "mantener", targetWeightKg: 76 })).toBeNull();
    expect(weeksToTarget({ ...base, targetWeightKg: 90 })).toBeNull();
  });
});

describe("gasto real", () => {
  const start = "2026-09-01";
  const days = (n: number, kcal: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [addDaysISO(start, i), kcal]));
  const weighIns = (n: number, every: number, from: number, perDay: number): WeightLog[] =>
    Array.from({ length: n }, (_, i) => ({ date: addDaysISO(start, i * every), kg: from + perDay * i * every }));

  it("peso estable: gastas lo que comes", () => {
    const e = estimateTdee(days(28, 2500), weighIns(5, 7, 80, 0));
    expect(e.tdee).toBe(2500);
    expect(e.kgPerWeek).toBe(0);
  });
  it("perdiendo 0,5 kg/semana comiendo 2000: gastas unas 2550", () => {
    const e = estimateTdee(days(28, 2000), weighIns(5, 7, 80, -0.5 / 7));
    expect(e.kgPerWeek).toBe(-0.5);
    expect(e.tdee).toBe(2550);
  });
  it("ignora los días a medio registrar", () => {
    const kcal = { ...days(20, 2500), [addDaysISO(start, 20)]: 300, [addDaysISO(start, 21)]: 0 };
    const e = estimateTdee(kcal, weighIns(5, 7, 80, 0));
    expect(e.days).toBe(20);
    expect(e.tdee).toBe(2500);
  });
  it("sin datos suficientes no propone nada, pero cuenta lo que hay", () => {
    expect(estimateTdee(days(10, 2500), weighIns(5, 7, 80, 0))).toMatchObject({ tdee: null, days: 10, weighIns: 5 });
    expect(estimateTdee(days(28, 2500), weighIns(3, 7, 80, 0)).tdee).toBeNull();
    expect(estimateTdee(days(28, 2500), weighIns(5, 2, 80, 0)).tdee).toBeNull(); // pesajes en solo 8 días
    expect(estimateTdee({}, [])).toMatchObject({ tdee: null, days: 0, weighIns: 0, avgKcal: 0 });
  });
  it("suma las kcal de cada día del diario", () => {
    const e = (date: string, grams: number) => ({ date, grams, per100g: { kcal: 200, protein: 0, carbs: 0, fat: 0 } }) as DiaryEntry;
    expect(kcalByDay([e("2026-09-01", 100), e("2026-09-01", 50), e("2026-09-02", 100)])).toEqual({ "2026-09-01": 300, "2026-09-02": 200 });
  });
});
