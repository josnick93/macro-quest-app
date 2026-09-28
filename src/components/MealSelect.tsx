import { MEALS, type MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MealSelect({ value, onChange }: { value: MealType; onChange: (m: MealType) => void }) {
  return (
    <div>
      <span className="label-sys">Comida</span>
      <div className="grid grid-cols-4 gap-2">
        {MEALS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={cn(
              "min-h-10 border text-xs",
              value === m.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function defaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "desayuno";
  if (h < 17) return "comida";
  if (h < 19) return "snacks";
  return "cena";
}
