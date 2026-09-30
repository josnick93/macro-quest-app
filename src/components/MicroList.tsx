import { MICROS } from "@/lib/types";
import type { Micros } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

/** "Fibra 3 g · Azúcares 12 g · Sal 0,4 g" — solo los que tienen datos. */
export function MicroList({ micros, className }: { micros: Micros; className?: string }) {
  const items = MICROS.filter(({ key }) => micros[key] !== undefined);
  if (!items.length) return null;
  const fmt = (v: number) => (v < 10 ? v.toLocaleString("es-ES", { maximumFractionDigits: 1 }) : String(Math.round(v)));
  return (
    <p className={cn("text-muted-foreground flex flex-wrap gap-x-3 text-[11px] tabular-nums", className)}>
      {items.map(({ key, label }) => (
        <span key={key}>
          {label} {fmt(micros[key]!)} g
        </span>
      ))}
    </p>
  );
}
