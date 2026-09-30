import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { SystemWindow } from "@/components/SystemWindow";
import { FoodPicker } from "@/components/FoodPicker";
import { FoodDetailSheet } from "@/components/FoodDetailSheet";
import { CustomFoodSheet } from "@/components/CustomFoodSheet";
import { defaultMeal } from "@/components/MealSelect";
import type { Food, MealType } from "@/lib/types";
import { MEALS } from "@/lib/types";
import { isISODate, relativeDayLabel } from "@/lib/date";
import { useAddEntries, useAddRecent, useRemoveCustomFood, useSaveCustomFood, useToday } from "@/lib/hooks";
import { mealLabel } from "@/components/MealSelect";

export function AddPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const paramMeal = params.get("comida") as MealType | null;
  const meal: MealType = paramMeal && MEALS.some((m) => m.id === paramMeal) ? paramMeal : defaultMeal();
  const today = useToday();
  const paramDate = params.get("fecha");
  const date = isISODate(paramDate) ? paramDate : today;
  const [selected, setSelected] = useState<Food | null>(null);
  const [customEdit, setCustomEdit] = useState<Food | "new" | null>(null);
  const addEntries = useAddEntries();
  const addRecent = useAddRecent();
  const saveCustom = useSaveCustomFood();
  const removeCustom = useRemoveCustomFood();

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-2xl font-bold">Añadir alimento</h1>
        <p className="text-muted-foreground text-xs">
          {paramMeal ? mealLabel(meal) : "Escanea, busca o elige de tus listas"} · {relativeDayLabel(date, today)}
        </p>
      </header>

      <SystemWindow>
        <FoodPicker onPick={setSelected} onCreateCustom={() => setCustomEdit("new")} />
      </SystemWindow>

      {selected && (
        <FoodDetailSheet
          food={selected}
          meal={meal}
          confirmLabel="Añadir al diario"
          onClose={() => setSelected(null)}
          onEditCustom={(f) => {
            setSelected(null);
            setCustomEdit(f);
          }}
          onConfirm={async (grams, m) => {
            const isRecipe = selected.id.startsWith("recipe:");
            await addEntries.mutateAsync([{
              date,
              meal: m,
              kind: isRecipe ? "recipe" : "food",
              name: selected.name,
              brand: selected.brand,
              grams,
              per100g: selected.per100g,
              foodId: selected.id,
              recipeId: isRecipe ? selected.id.slice(7) : undefined,
            }]);
            if (!isRecipe) addRecent.mutate(selected);
            toast.success(`${selected.name} · ${grams} g añadido`);
            setSelected(null);
            navigate(date === today ? "/" : `/?fecha=${date}`);
          }}
        />
      )}

      {customEdit && (
        <CustomFoodSheet
          food={customEdit === "new" ? undefined : customEdit}
          onClose={() => setCustomEdit(null)}
          onDelete={(id) => {
            removeCustom.mutate(id);
            setCustomEdit(null);
            toast.success("Alimento borrado");
          }}
          onSave={async (f) => {
            await saveCustom.mutateAsync(f);
            addRecent.mutate(f);
            setCustomEdit(null);
            setSelected(f);
          }}
        />
      )}
    </div>
  );
}
