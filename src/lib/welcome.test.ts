import { describe, expect, it } from "vitest";
import { basicsError, EMPTY_BASICS, profileFromBasics, type Basics } from "./welcome";
import { calcTargets } from "./nutrition";

const ok: Basics = { sex: "mujer", age: 30, heightCm: 165, weightKg: 60, activity: "ligero" };

describe("bienvenida", () => {
  it("pide cada dato que falta, en orden", () => {
    expect(basicsError(EMPTY_BASICS)).toContain("sexo");
    expect(basicsError({ ...ok, age: undefined })).toContain("edad");
    expect(basicsError({ ...ok, heightCm: undefined })).toContain("altura");
    expect(basicsError({ ...ok, activity: null })).toContain("actividad");
    expect(basicsError(ok)).toBeNull();
  });
  it("rechaza valores imposibles (metros en vez de centímetros, etc.)", () => {
    expect(basicsError({ ...ok, heightCm: 1.65 })).toContain("entre 120 y 230");
    expect(basicsError({ ...ok, weightKg: 600 })).toContain("entre 30 y 300");
    expect(basicsError({ ...ok, age: 9 })).toContain("entre 14 y 100");
  });
  it("sin datos válidos no hay perfil", () => {
    expect(profileFromBasics(EMPTY_BASICS, "mantener")).toBeNull();
  });
  it("crea el perfil con el ritmo recomendado para el objetivo", () => {
    expect(profileFromBasics(ok, "perder")).toMatchObject({ sex: "mujer", weightKg: 60, goal: "perder", rateKgWeek: 0.3 });
    expect(profileFromBasics(ok, "ganar")!.rateKgWeek).toBe(0.15);
  });
  it("en mantenimiento el objetivo es el gasto, y queda un ritmo listo por si luego se cambia", () => {
    const p = profileFromBasics(ok, "mantener")!;
    const t = calcTargets(p);
    expect(t.kcal).toBe(t.tdee);
    expect(p.rateKgWeek).toBeGreaterThan(0);
  });
});
