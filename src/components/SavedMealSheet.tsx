import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { MacroLine } from "./MacroLine";
import { MealSelect } from "./MealSelect";
import type { MealType, SavedMeal, SavedMealItem } from "@/lib/types";
import { entryMacros, totalsFor } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

interface Props {
  meal: SavedMeal;
  target: MealType;
  onLog: (items: SavedMealItem[], meal: MealType) => void;
  onDelete: (meal: SavedMeal) => void;
  onClose: () => void;
}

/** Registrar una comida guardada de golpe (se pueden desmarcar alimentos). */
export function SavedMealSheet({ meal, target, onLog, onDelete, onClose }: Props) {
  const [off, setOff] = useState<Set<number>>(new Set());
  const [to, setTo] = useState(target);
  const chosen = meal.items.filter((_, i) => !off.has(i));

  return (
    <Sheet title={meal.name} onClose={onClose}>
      <div className="space-y-4">
        <ul className="divide-border/40 divide-y">
          {meal.items.map((item, i) => {
            const on = !off.has(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={on}
                  className="flex min-h-11 w-full items-center gap-3 py-2 text-left"
                  onClick={() =>
                    setOff((s) => {
                      const n = new Set(s);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })
                  }
                >
                  <span
                    aria-hidden="true"
                    className={cn("flex h-6 w-6 shrink-0 items-center justify-center border", on ? "border-primary text-primary" : "border-border text-transparent")}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.name}</span>
                    <span className="block text-xs">
                      {item.kind !== "quick" && <span className="text-muted-foreground tabular-nums">{Math.round(item.grams)} g · </span>}
                      <MacroLine m={entryMacros(item)} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <MealSelect value={to} onChange={setTo} />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost text-destructive"
            aria-label="Borrar comida guardada"
            onClick={() => confirm(`¿Borrar la comida guardada "${meal.name}"?`) && onDelete(meal)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button className="btn-primary flex-1" disabled={chosen.length === 0} onClick={() => onLog(chosen, to)}>
            Registrar {chosen.length} · {Math.round(totalsFor(chosen).kcal)} kcal
          </button>
        </div>
      </div>
    </Sheet>
  );
}
