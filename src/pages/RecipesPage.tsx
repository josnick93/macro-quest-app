import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChefHat, Copy, Pencil, Plus, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { SystemWindow } from "@/components/SystemWindow";
import { Sheet } from "@/components/Sheet";
import { FoodPicker } from "@/components/FoodPicker";
import { FoodDetailSheet } from "@/components/FoodDetailSheet";
import { FoodFormSheet } from "@/components/FoodFormSheet";
import { MacroLine } from "@/components/MacroLine";
import { defaultMeal } from "@/components/MealSelect";
import type { Food, Recipe, RecipeIngredient } from "@/lib/types";
import { recipePer100g, recipeRawWeight, recipeTotals, scaleMacros } from "@/lib/nutrition";
import { uid } from "@/lib/repos/local";
import { todayISO } from "@/lib/date";
import { recipeAsFood, recipeFoodId } from "@/lib/foods";
import { useAddEntries, useFoodLibrary, useRecipes, useRememberFood, useRemoveRecipe, useSaveFood, useSaveRecipe } from "@/lib/hooks";

const emptyRecipe = (): Recipe => ({ id: uid(), name: "", ingredients: [], cookedWeight: 0, createdAt: new Date().toISOString() });

function RecipeEditor({ initial, onClose }: { initial: Recipe; onClose: () => void }) {
  const [r, setR] = useState<Recipe>(initial);
  const [cooked, setCooked] = useState(initial.cookedWeight ? String(initial.cookedWeight) : "");
  const [picking, setPicking] = useState(false);
  const [food, setFood] = useState<Food | null>(null);
  const [form, setForm] = useState<{ barcode?: string } | null>(null);
  const [servings, setServings] = useState(initial.servings ? String(initial.servings) : "");
  const save = useSaveRecipe();
  const saveFood = useSaveFood();
  const remember = useRememberFood();

  const raw = recipeRawWeight(r);
  const total = recipeTotals(r);
  const nServings = parseInt(servings, 10) || 0;
  const withCooked: Recipe = { ...r, cookedWeight: parseFloat(cooked) || 0, servings: nServings > 0 ? nServings : undefined };
  const per100 = recipePer100g(withCooked);
  const finalWeight = withCooked.cookedWeight || raw;

  const addIng = (grams: number) => {
    if (!food) return;
    const ing: RecipeIngredient = { id: uid(), name: food.name, grams, per100g: food.per100g, foodId: food.id };
    if (food.source === "off") remember.mutate(food);
    setR((p) => ({ ...p, ingredients: [...p.ingredients, ing] }));
    setFood(null);
    setPicking(false);
  };

  const setGrams = (id: string, v: string) =>
    setR((p) => ({ ...p, ingredients: p.ingredients.map((i) => (i.id === id ? { ...i, grams: parseFloat(v) || 0 } : i)) }));

  const submit = async () => {
    if (!r.name.trim()) return toast.error("Ponle nombre a la receta");
    if (!r.ingredients.length) return toast.error("Añade al menos un ingrediente");
    await save.mutateAsync({ ...withCooked, name: r.name.trim() });
    toast.success("Receta guardada");
    onClose();
  };

  if (form)
    return (
      <FoodFormSheet
        barcode={form.barcode}
        onClose={() => setForm(null)}
        onSave={async (f) => {
          await saveFood.mutateAsync(f);
          setForm(null);
          setFood(f);
        }}
      />
    );

  if (food)
    return <FoodDetailSheet food={food} confirmLabel="Añadir ingrediente" onClose={() => setFood(null)} onConfirm={(g) => addIng(g)} />;

  if (picking)
    return (
      <Sheet title="Ingrediente" onClose={() => setPicking(false)}>
        <FoodPicker mode="ingredient" onPick={(f) => setFood(f)} onCreateFood={(barcode) => setForm(barcode ? { barcode } : {})} />
      </Sheet>
    );

  return (
    <Sheet title={initial.name ? "Editar receta" : "Nueva receta"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label-sys" htmlFor="rname">Nombre</label>
          <input id="rname" className="field" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="Lentejas con chorizo" />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label-sys mb-0">Ingredientes (crudo)</span>
            <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => setPicking(true)}>
              <Plus className="h-4 w-4" /> Añadir
            </button>
          </div>
          {r.ingredients.length === 0 && <p className="text-muted-foreground text-xs">Sin ingredientes todavía</p>}
          <ul className="divide-border divide-y">
            {r.ingredients.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{i.name}</p>
                  <MacroLine m={scaleMacros(i.per100g, i.grams)} className="text-[11px]" />
                </div>
                <input
                  className="field w-20 px-2 py-1 text-right tabular-nums"
                  inputMode="decimal"
                  value={i.grams || ""}
                  onChange={(e) => setGrams(i.id, e.target.value.replace(",", "."))}
                  aria-label={`Gramos de ${i.name}`}
                />
                <span className="text-muted-foreground text-xs">g</span>
                <button
                  type="button"
                  aria-label="Quitar"
                  className="text-muted-foreground hover:text-destructive p-2"
                  onClick={() => setR({ ...r, ingredients: r.ingredients.filter((x) => x.id !== i.id) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="label-sys" htmlFor="cooked">Peso final cocinado (g)</label>
          <input
            id="cooked"
            className="field tabular-nums"
            inputMode="decimal"
            placeholder={raw ? `Crudo: ${Math.round(raw)} g` : "Pesa la olla sin la olla"}
            value={cooked}
            onChange={(e) => setCooked(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
          />
          <p className="text-muted-foreground mt-1 text-[11px]">Si lo dejas vacío se usa el peso crudo ({Math.round(raw)} g).</p>
        </div>

        <div>
          <label className="label-sys" htmlFor="servings">Raciones (opcional)</label>
          <input
            id="servings"
            className="field tabular-nums"
            inputMode="numeric"
            placeholder="Ej.: 4"
            value={servings}
            onChange={(e) => setServings(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        <div className="border-border space-y-1 border p-3 text-xs">
          <p><span className="label-sys inline">Total</span> <MacroLine m={total} /></p>
          <p><span className="label-sys inline">Por 100 g</span> <MacroLine m={per100} /></p>
          {nServings > 0 && finalWeight > 0 && (
            <p>
              <span className="label-sys inline">Por ración ({Math.round(finalWeight / nServings)} g)</span>{" "}
              <MacroLine m={scaleMacros(per100, finalWeight / nServings)} />
            </p>
          )}
        </div>

        <button className="btn-primary w-full" onClick={submit} disabled={save.isPending}>Guardar receta</button>
      </div>
    </Sheet>
  );
}

export function RecipesPage() {
  const { data: recipes } = useRecipes();
  const remove = useRemoveRecipe();
  const addEntries = useAddEntries();
  const save = useSaveRecipe();
  const { stats } = useFoodLibrary();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [logging, setLogging] = useState<Recipe | null>(null);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between px-1">
        <div>
          <h1 className="font-display text-2xl font-bold">Recetas</h1>
          <p className="text-muted-foreground text-xs">Ingredientes en crudo + peso final = macros por ración</p>
        </div>
        <button className="btn-primary min-h-10 px-3 text-sm" onClick={() => setEditing(emptyRecipe())}>
          <Plus className="h-4 w-4" /> Nueva
        </button>
      </header>

      {recipes.length === 0 && (
        <SystemWindow>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ChefHat className="text-primary h-8 w-8" />
            <p className="text-sm">Aún no tienes recetas</p>
            <p className="text-muted-foreground text-xs">Crea una con lo que cocinas a menudo y regístrala en segundos.</p>
          </div>
        </SystemWindow>
      )}

      {recipes.map((r) => {
        const per100 = recipePer100g(r);
        const weight = r.cookedWeight || recipeRawWeight(r);
        return (
          <SystemWindow key={r.id} scan={false}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-display truncate text-lg font-semibold">{r.name}</h3>
                <p className="text-muted-foreground text-[11px]">
                  {r.ingredients.length} {r.ingredients.length === 1 ? "ingrediente" : "ingredientes"} · {Math.round(weight)} g cocinado
                  {r.servings ? ` · ${r.servings} raciones de ${Math.round(weight / r.servings)} g` : ""}
                </p>
                <MacroLine m={per100} className="text-xs" />
                <span className="text-muted-foreground text-[10px]"> / 100 g</span>
              </div>
              <button aria-label="Editar" className="text-muted-foreground flex h-11 w-9 items-center justify-center" onClick={() => setEditing(r)}>
                <Pencil className="h-4 w-4" />
              </button>
              <button
                aria-label="Duplicar"
                className="text-muted-foreground flex h-11 w-9 items-center justify-center"
                onClick={async () => {
                  const now = new Date().toISOString();
                  await save.mutateAsync({
                    ...r,
                    id: uid(),
                    name: `${r.name} (copia)`,
                    ingredients: r.ingredients.map((i) => ({ ...i, id: uid() })),
                    createdAt: now,
                  });
                  toast.success("Receta duplicada");
                }}
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                aria-label="Borrar"
                className="text-muted-foreground hover:text-destructive flex h-11 w-9 items-center justify-center"
                onClick={() => {
                  if (confirm(`¿Borrar "${r.name}"?`)) {
                    remove.mutate(r.id);
                    toast.success("Receta borrada");
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <button className="btn-ghost mt-3 w-full" onClick={() => setLogging(r)}>
              <Utensils className="h-4 w-4" /> Registrar ración
            </button>
          </SystemWindow>
        );
      })}

      {editing && <RecipeEditor initial={editing} onClose={() => setEditing(null)} />}

      {logging && (
        <FoodDetailSheet
          food={recipeAsFood(logging)}
          meal={defaultMeal()}
          lastGrams={stats.lastGrams[recipeFoodId(logging.id)]}
          confirmLabel="Añadir al diario"
          onClose={() => setLogging(null)}
          onConfirm={async (grams, meal) => {
            await addEntries.mutateAsync([{
              date: todayISO(),
              meal,
              kind: "recipe",
              name: logging.name,
              brand: "Mi receta",
              grams,
              per100g: recipePer100g(logging),
              recipeId: logging.id,
              foodId: recipeFoodId(logging.id),
            }]);
            toast.success(`${logging.name} · ${grams} g añadido`);
            setLogging(null);
            navigate("/");
          }}
        />
      )}
    </div>
  );
}
