import { useState } from "react";
import { Pencil, Star } from "lucide-react";
import { Sheet } from "./Sheet";
import { QuantityField } from "./QuantityField";
import { MealSelect } from "./MealSelect";
import { MacroLine } from "./MacroLine";
import { SourceBadge } from "./SourceBadge";
import { MicroList } from "./MicroList";
import type { Food, MealType } from "@/lib/types";
import { scaleMacros, scaleMicros } from "@/lib/nutrition";
import { defaultQuantity, quantityGrams, unitsFor } from "@/lib/foods";
import { useFavoriteIds, useToggleFavorite } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface Props {
  food: Food;
  /** Si se indica, muestra selector de comida (modo diario). */
  meal?: MealType;
  /** Última cantidad usada de este alimento (se preselecciona). */
  lastGrams?: number | undefined;
  confirmLabel: string;
  onConfirm: (grams: number, meal: MealType) => void;
  onClose: () => void;
  /** Editar (propio) o corregir datos (Open Food Facts). */
  onEdit?: (food: Food) => void;
}

export function FoodDetailSheet({ food, meal: initialMeal, lastGrams, confirmLabel, onConfirm, onClose, onEdit }: Props) {
  const [qty, setQty] = useState(() => defaultQuantity(food, lastGrams));
  const [meal, setMeal] = useState<MealType>(initialMeal ?? "comida");
  const { data: favIds } = useFavoriteIds();
  const toggleFav = useToggleFavorite();
  const isFav = favIds.includes(food.id);
  const g = quantityGrams(qty);
  const m = scaleMacros(food.per100g, g);
  const canEdit = onEdit && food.source !== "recipe";

  return (
    <Sheet title="Alimento" onClose={onClose}>
      <div className="mb-4 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-tight font-bold">{food.name}</p>
          <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-sm">
            {food.brand && <span>{food.brand}</span>}
            <SourceBadge food={food} />
          </p>
          <p className="mt-1 text-xs">
            Por 100 g: <MacroLine m={food.per100g} />
          </p>
        </div>
        {canEdit && (
          <button
            aria-label={food.source === "custom" ? "Editar alimento" : "Corregir datos"}
            title={food.source === "custom" ? "Editar" : "Corregir datos"}
            className="btn-ghost h-11 min-h-0 w-11 p-0"
            onClick={() => onEdit(food)}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button
          aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
          aria-pressed={isFav}
          className={cn("btn-ghost h-11 min-h-0 w-11 p-0", isFav && "text-carbs")}
          onClick={() => toggleFav.mutate(food)}
        >
          <Star className={cn("h-4 w-4", isFav && "fill-current")} />
        </button>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (g > 0) onConfirm(g, meal);
        }}
      >
        <QuantityField units={unitsFor(food)} value={qty} onChange={setQty} />
        {initialMeal && <MealSelect value={meal} onChange={setMeal} />}

        <div className="border-border border p-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {(
              [
                ["kcal", m.kcal, "text-foreground"],
                ["Prot", m.protein, "text-protein"],
                ["Carb", m.carbs, "text-carbs"],
                ["Grasa", m.fat, "text-fat"],
              ] as const
            ).map(([l, v, c]) => (
              <div key={l}>
                <p className={cn("font-display text-2xl font-bold tabular-nums", c)}>{Math.round(v)}</p>
                <p className="text-muted-foreground text-[10px] tracking-widest uppercase">{l}</p>
              </div>
            ))}
          </div>
          <MicroList micros={scaleMicros(food.per100g, g)} className="mt-2 justify-center" />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={g <= 0}>
          {confirmLabel}
        </button>
      </form>
    </Sheet>
  );
}
