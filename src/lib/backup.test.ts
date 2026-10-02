import { describe, expect, it } from "vitest";
import { backupDue, daysSince } from "./backup";

const NOW = Date.parse("2026-10-02T10:00:00.000Z");
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

describe("recordatorio de copia", () => {
  it("cuenta días enteros y tolera fechas inválidas", () => {
    expect(daysSince(ago(3), NOW)).toBe(3);
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince("no-es-fecha", NOW)).toBeNull();
  });
  it("no avisa con poco diario", () => {
    expect(backupDue(null, null, 2, NOW)).toBe(false);
  });
  it("avisa si nunca se ha exportado o hace más de dos semanas", () => {
    expect(backupDue(null, null, 3, NOW)).toBe(true);
    expect(backupDue(ago(14), null, 30, NOW)).toBe(true);
    expect(backupDue(ago(13), null, 30, NOW)).toBe(false);
  });
  it("no repite el aviso en la misma semana", () => {
    expect(backupDue(null, ago(6), 30, NOW)).toBe(false);
    expect(backupDue(null, ago(7), 30, NOW)).toBe(true);
  });
});
