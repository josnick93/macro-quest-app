import type { Food } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Datos honestos: de dónde viene cada alimento. */
export function sourceLabel(food: Pick<Food, "source" | "edited">): string {
  if (food.source === "custom") return "Propio";
  if (food.source === "recipe") return "Receta";
  return food.edited ? "OFF · corregido" : "Open Food Facts";
}

export function SourceBadge({ food, className }: { food: Pick<Food, "source" | "edited">; className?: string }) {
  return (
    <span
      className={cn(
        "border px-1.5 py-0.5 text-[10px] tracking-wider uppercase",
        food.source === "off" && !food.edited ? "border-border text-muted-foreground" : "border-primary/50 text-primary",
        className,
      )}
    >
      {sourceLabel(food)}
    </span>
  );
}
