import { MEALS, type MealType } from "@/lib/types";
import { useSettings } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function MealSelect({ value, onChange }: { value: MealType; onChange: (m: MealType) => void }) {
  const { data: settings } = useSettings();
  const meals = MEALS.filter((m) => m.id === value || !settings.hiddenMeals.includes(m.id));
  return (
    <div>
      <span className="label-sys">Comida</span>
      <div className="grid grid-cols-3 gap-2">
        {meals.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            aria-pressed={value === m.id}
            className={cn(
              "min-h-11 border text-xs",
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

export function defaultMeal(date = new Date()): MealType {
  const t = date.getHours() + date.getMinutes() / 60;
  if (t < 10.5) return "desayuno";
  if (t < 13) return "almuerzo";
  if (t < 16.5) return "comida";
  if (t < 19.5) return "merienda";
  return "cena";
}

export const mealLabel = (id: MealType) => MEALS.find((m) => m.id === id)?.label ?? id;
