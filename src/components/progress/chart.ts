/** Estilo común de las gráficas de Progreso. */
export const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
export const tip = {
  contentStyle: { background: "oklch(0.16 0.03 256)", border: "1px solid var(--primary)", fontSize: 12 },
  labelStyle: { color: "var(--muted-foreground)" },
};
export const GRID = "oklch(0.3 0.04 256 / 0.4)";
