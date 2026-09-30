import { describe, expect, it } from "vitest";
import { copyEntries, QUICK_ADD_NAME, quickEntry } from "./diary";
import { entryMacros } from "./nutrition";
import type { DiaryEntry } from "./types";

const e: DiaryEntry = {
  id: "x",
  date: "2026-09-29",
  meal: "desayuno",
  kind: "food",
  name: "Avena",
  grams: 60,
  per100g: { kcal: 370, protein: 13, carbs: 60, fat: 7 },
  createdAt: "c",
  updatedAt: "u",
};

describe("copyEntries", () => {
  it("cambia fecha, quita identidad y mantiene la comida", () => {
    const [c] = copyEntries([e], "2026-09-30");
    expect(c).toEqual({ date: "2026-09-30", meal: "desayuno", kind: "food", name: "Avena", grams: 60, per100g: e.per100g });
  });
  it("puede mover a otra comida", () => {
    expect(copyEntries([e], "2026-09-30", "merienda")[0]!.meal).toBe("merienda");
  });
});

describe("quickEntry", () => {
  it("guarda kcal y macros como total", () => {
    const q = quickEntry("2026-09-30", "cena", { kcal: 450, protein: 30 });
    const full = { ...q, id: "q", createdAt: "", updatedAt: "" };
    expect(entryMacros(full)).toEqual({ kcal: 450, protein: 30, carbs: 0, fat: 0 });
    expect(q.name).toBe(QUICK_ADD_NAME);
    expect(q.kind).toBe("quick");
  });
  it("calcula kcal a partir de macros si faltan", () => {
    expect(quickEntry("d", "cena", { protein: 10, carbs: 20, fat: 5 }).per100g.kcal).toBe(165);
  });
});
