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
import { todayISO } from "@/lib/date";
import { useAddEntry, useAddRecent, useRemoveCustomFood, useSaveCustomFood } from "@/lib/hooks";

export function AddPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const paramMeal = params.get("comida") as MealType | null;
  const meal: MealType = paramMeal && MEALS.some((m) => m.id === paramMeal) ? paramMeal : defaultMeal();
  const [selected, setSelected] = useState<Food | null>(null);
  const [customEdit, setCustomEdit] = useState<Food | "new" | null>(null);
  const addEntry = useAddEntry();
  const addRecent = useAddRecent();
  const saveCustom = useSaveCustomFood();
  const removeCustom = useRemoveCustomFood();

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-2xl font-bold">Añadir alimento</h1>
        <p className="text-muted-foreground text-xs">Escanea, busca o elige de tus listas</p>
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
            await addEntry.mutateAsync({
              date: todayISO(),
              meal: m,
              name: selected.name,
              brand: selected.brand,
              grams,
              per100g: selected.per100g,
              foodId: selected.id,
              recipeId: selected.id.startsWith("recipe:") ? selected.id.slice(7) : undefined,
            });
            if (!selected.id.startsWith("recipe:")) addRecent.mutate(selected);
            toast.success(`${selected.name} · ${grams} g añadido`);
            setSelected(null);
            navigate("/");
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
