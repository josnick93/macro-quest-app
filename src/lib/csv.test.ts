import { describe, expect, it } from "vitest";
import { csvCell, diaryCsv } from "./csv";
import type { DiaryEntry } from "./types";

const entry = (extra: Partial<DiaryEntry>): DiaryEntry => ({
  id: "x",
  date: "2026-10-01",
  meal: "comida",
  kind: "food",
  name: "Arroz",
  grams: 150,
  per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "",
  ...extra,
});

describe("CSV del diario", () => {
  it("celdas: comillas cuando hace falta y sin fórmulas", () => {
    expect(csvCell("Pan")).toBe("Pan");
    expect(csvCell('Yogur "griego"; natural')).toBe('"Yogur ""griego""; natural"');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("-5")).toBe("'-5");
  });

  it("una fila por entrada, ordenadas por fecha, comida y hora, con coma decimal", () => {
    const csv = diaryCsv([
      entry({ meal: "cena", name: "Cena fuera", kind: "quick", grams: 100, per100g: { kcal: 800, protein: 30, carbs: 70, fat: 40 } }),
      entry({ meal: "desayuno", name: "Avena", grams: 50, per100g: { kcal: 370, protein: 13, carbs: 60, fat: 7, fiber: 10 } }),
      entry({ date: "2026-09-30", brand: "Marca; S.A." }),
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "Fecha;Comida;Tipo;Nombre;Marca;Gramos;kcal;Proteína (g);Carbohidratos (g);Grasa (g);Fibra (g);Azúcares (g);Grasa saturada (g);Sal (g)",
    );
    expect(lines.slice(1)).toEqual([
      '2026-09-30;Comida;Alimento;Arroz;"Marca; S.A.";150;195;4,05;42;0,45;;;;',
      "2026-10-01;Desayuno;Alimento;Avena;;50;185;6,5;30;3,5;5;;;",
      "2026-10-01;Cena;Añadido rápido;Cena fuera;;;800;30;70;40;;;;",
    ]);
  });

  it("sin entradas queda solo la cabecera", () => {
    expect(diaryCsv([]).slice(1).trimEnd().split("\r\n")).toHaveLength(1);
  });
});
