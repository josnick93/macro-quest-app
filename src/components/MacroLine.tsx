import type { Macros } from "@/lib/types";

export function MacroLine({ m, className = "" }: { m: Macros; className?: string }) {
  return (
    <span className={`text-muted-foreground tabular-nums ${className}`}>
      {Math.round(m.kcal)} kcal · <span className="text-protein">P {Math.round(m.protein)}</span> ·{" "}
      <span className="text-carbs">C {Math.round(m.carbs)}</span> · <span className="text-fat">G {Math.round(m.fat)}</span>
    </span>
  );
}
