import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { SystemWindow } from "@/components/SystemWindow";
import { FoodPicker } from "@/components/FoodPicker";
import { FoodDetailSheet } from "@/components/FoodDetailSheet";
import { FoodFormSheet } from "@/components/FoodFormSheet";
import { SavedMealSheet } from "@/components/SavedMealSheet";
import { defaultMeal, mealLabel } from "@/components/MealSelect";
import type { DiaryEntry, Food, MealType, NewEntry, SavedMeal } from "@/lib/types";
import { MEALS } from "@/lib/types";
import { isISODate, relativeDayLabel } from "@/lib/date";
import { defaultQuantity, formatQuantity, quantityGrams, RECIPE_PREFIX } from "@/lib/foods";
import { totalsFor } from "@/lib/nutrition";
import {
  useAddEntries,
  useFoodLibrary,
  useRememberFood,
  useRemoveEntries,
  useRemoveFood,
  useRemoveSavedMeal,
  useSaveFood,
  useToday,
} from "@/lib/hooks";

function entryFor(food: Food, grams: number, date: string, meal: MealType): NewEntry {
  const isRecipe = food.source === "recipe";
  return {
    date,
    meal,
    kind: isRecipe ? "recipe" : "food",
    name: food.name,
    brand: food.brand,
    grams,
    per100g: food.per100g,
    foodId: food.id,
    recipeId: isRecipe ? food.id.slice(RECIPE_PREFIX.length) : undefined,
  };
}

export function AddPage() {
  const [params] = useSearchParams();
  const today = useToday();
  const paramMeal = params.get("comida") as MealType | null;
  const meal: MealType = paramMeal && MEALS.some((m) => m.id === paramMeal) ? paramMeal : defaultMeal();
  const paramDate = params.get("fecha");
  const date = isISODate(paramDate) ? paramDate : today;

  const lib = useFoodLibrary();
  const [selected, setSelected] = useState<{ food: Food; fromScan: boolean } | null>(null);
  const [form, setForm] = useState<{ food?: Food; barcode?: string } | null>(null);
  const [savedMeal, setSavedMeal] = useState<SavedMeal | null>(null);
  const [scanResume, setScanResume] = useState(0);
  /** Lo añadido en esta visita: permite registrar varios alimentos seguidos. */
  const [session, setSession] = useState<DiaryEntry[]>([]);

  const addEntries = useAddEntries();
  const removeEntries = useRemoveEntries();
  const remember = useRememberFood();
  const saveFood = useSaveFood();
  const removeFood = useRemoveFood();
  const removeSavedMeal = useRemoveSavedMeal();

  const log = async (list: NewEntry[], foods: Food[], message: string) => {
    const added = await addEntries.mutateAsync(list);
    for (const f of foods) if (f.source === "off") remember.mutate(f);
    setSession((s) => [...s, ...added]);
    const ids = new Set(added.map((e) => e.id));
    toast.success(message, {
      action: {
        label: "Deshacer",
        onClick: () => {
          removeEntries.mutate([...ids]);
          setSession((s) => s.filter((e) => !ids.has(e.id)));
        },
      },
    });
  };

  const quickAdd = (food: Food) => {
    const qty = defaultQuantity(food, lib.stats.lastGrams[food.id]);
    log([entryFor(food, quantityGrams(qty), date, meal)], [food], `${food.name} · ${formatQuantity(qty)} → ${mealLabel(meal).toLowerCase()}`);
  };

  const diaryLink = date === today ? "/" : `/?fecha=${date}`;
  const sessionKcal = Math.round(totalsFor(session).kcal);

  return (
    <div className={session.length ? "space-y-4 pb-16" : "space-y-4"}>
      <header className="px-1">
        <h1 className="font-display text-2xl font-bold">Añadir a {mealLabel(meal).toLowerCase()}</h1>
        <p className="text-muted-foreground text-xs">
          {relativeDayLabel(date, today)} · Toca un alimento para elegir cantidad, o «+» para repetir la habitual
        </p>
      </header>

      <SystemWindow>
        <FoodPicker
          onPick={(food, { fromScan }) => setSelected({ food, fromScan })}
          onQuickAdd={quickAdd}
          onCreateFood={(barcode) => setForm(barcode ? { barcode } : {})}
          onPickSavedMeal={setSavedMeal}
          scanResume={scanResume}
        />
      </SystemWindow>

      {session.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg px-4 pb-2">
          <div className="system-window flex items-center gap-3 px-4 py-2">
            <Check className="text-success h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm tabular-nums">
              {session.length} {session.length === 1 ? "añadido" : "añadidos"} · {sessionKcal} kcal
            </span>
            <Link to={diaryLink} className="btn-primary min-h-11 px-4 text-sm">
              Ver diario
            </Link>
          </div>
        </div>
      )}

      {selected && (
        <FoodDetailSheet
          food={selected.food}
          meal={meal}
          lastGrams={lib.stats.lastGrams[selected.food.id]}
          confirmLabel="Añadir al diario"
          onClose={() => setSelected(null)}
          onEdit={(f) => {
            setSelected(null);
            setForm({ food: f });
          }}
          onConfirm={async (grams, m) => {
            const { food, fromScan } = selected;
            setSelected(null);
            await log([entryFor(food, grams, date, m)], [food], `${food.name} · ${grams} g → ${mealLabel(m).toLowerCase()}`);
            if (fromScan) setScanResume((n) => n + 1);
          }}
        />
      )}

      {form && (
        <FoodFormSheet
          food={form.food}
          barcode={form.barcode}
          onClose={() => setForm(null)}
          onDelete={(f) => {
            removeFood.mutate(f.id);
            setForm(null);
            toast.success(f.source === "custom" ? "Alimento borrado" : "Corrección descartada");
          }}
          onSave={async (f) => {
            await saveFood.mutateAsync(f);
            setForm(null);
            toast.success(form.food ? "Alimento actualizado" : "Alimento creado");
            setSelected({ food: f, fromScan: !!form.barcode });
          }}
        />
      )}

      {savedMeal && (
        <SavedMealSheet
          meal={savedMeal}
          target={meal}
          onClose={() => setSavedMeal(null)}
          onDelete={(m) => {
            removeSavedMeal.mutate(m.id);
            setSavedMeal(null);
            toast.success("Comida guardada borrada");
          }}
          onLog={(items, m) => {
            const name = savedMeal.name;
            setSavedMeal(null);
            log(
              items.map((i) => ({ ...i, date, meal: m })),
              [],
              `${name}: ${items.length} alimentos → ${mealLabel(m).toLowerCase()}`,
            );
          }}
        />
      )}
    </div>
  );
}
