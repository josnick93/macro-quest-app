import { MEALS, MICROS, type DiaryEntry } from "./types";
import { entryMacros, scaleMicros } from "./nutrition";

/**
 * Diario en CSV para Excel/Sheets en español: separador «;», coma decimal y BOM para que abra los acentos bien.
 * Una fila por entrada, ordenadas por fecha, comida y hora de registro.
 */

const SEP = ";";
const KIND: Record<DiaryEntry["kind"], string> = { food: "Alimento", recipe: "Receta", quick: "Añadido rápido" };
const mealIndex = (m: DiaryEntry["meal"]) => MEALS.findIndex((x) => x.id === m);

const num = (n: number | undefined) =>
  n === undefined ? "" : (Math.round(n * 100) / 100).toLocaleString("es-ES", { maximumFractionDigits: 2, useGrouping: false });

/** Entre comillas si hace falta; y un apóstrofo delante de =, +, -, @ para que la hoja no lo ejecute como fórmula. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export const CSV_HEADER = [
  "Fecha",
  "Comida",
  "Tipo",
  "Nombre",
  "Marca",
  "Gramos",
  "kcal",
  "Proteína (g)",
  "Carbohidratos (g)",
  "Grasa (g)",
  ...MICROS.map((m) => `${m.label} (g)`),
];

export function diaryCsv(entries: DiaryEntry[]): string {
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || mealIndex(a.meal) - mealIndex(b.meal) || a.createdAt.localeCompare(b.createdAt),
  );
  const rows = sorted.map((e) => {
    const m = entryMacros(e);
    const micros = scaleMicros(e.per100g, e.grams);
    return [
      e.date,
      MEALS[mealIndex(e.meal)]?.label ?? e.meal,
      KIND[e.kind],
      csvCell(e.name),
      csvCell(e.brand ?? ""),
      e.kind === "quick" ? "" : num(e.grams),
      num(m.kcal),
      num(m.protein),
      num(m.carbs),
      num(m.fat),
      ...MICROS.map(({ key }) => num(micros[key])),
    ].join(SEP);
  });
  return "﻿" + [CSV_HEADER.join(SEP), ...rows].join("\r\n") + "\r\n";
}
