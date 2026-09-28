import { useState } from "react";
import { Pencil, Star } from "lucide-react";
import { Sheet } from "./Sheet";
import { GramsField } from "./GramsField";
import { MealSelect } from "./MealSelect";
import { MacroLine } from "./MacroLine";
import type { Food, MealType } from "@/lib/types";
import { scaleMacros } from "@/lib/nutrition";
import { useFavorites, useToggleFavorite } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface Props {
  food: Food;
  /** Si se indica, muestra selector de comida (modo diario). */
  meal?: MealType;
  confirmLabel: string;
  onConfirm: (grams: number, meal: MealType) => void;
  onClose: () => void;
  onEditCustom?: (food: Food) => void;
}

export function FoodDetailSheet({ food, meal: initialMeal, confirmLabel, onConfirm, onClose, onEditCustom }: Props) {
  const [grams, setGrams] = useState("100");
  const [meal, setMeal] = useState<MealType>(initialMeal ?? "comida");
  const { data: favs } = useFavorites();
  const toggleFav = useToggleFavorite();
  const isFav = favs.some((f) => f.id === food.id);
  const g = parseFloat(grams) || 0;
  const m = scaleMacros(food.per100g, g);

  return (
    <Sheet title="Alimento" onClose={onClose}>
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-tight font-bold">{food.name}</p>
          {food.brand && <p className="text-muted-foreground text-sm">{food.brand}</p>}
          <p className="mt-1 text-xs">
            Por 100 g: <MacroLine m={food.per100g} />
          </p>
        </div>
        {food.custom && onEditCustom && (
          <button aria-label="Editar alimento" className="btn-ghost h-11 min-h-0 w-11 p-0" onClick={() => onEditCustom(food)}>
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button
          aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
          className={cn("btn-ghost h-11 min-h-0 w-11 p-0", isFav && "text-carbs")}
          onClick={() => toggleFav.mutate(food)}
        >
          <Star className={cn("h-4 w-4", isFav && "fill-current")} />
        </button>
      </div>

      <div className="space-y-4">
        <GramsField value={grams} onChange={setGrams} autoFocus />
        {initialMeal && <MealSelect value={meal} onChange={setMeal} />}

        <div className="border-border grid grid-cols-4 gap-2 border p-3 text-center">
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

        <button className="btn-primary w-full" disabled={g <= 0} onClick={() => onConfirm(g, meal)}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
