import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2, PackagePlus, ScanBarcode, Search } from "lucide-react";
import { toast } from "sonner";
import { MacroLine } from "./MacroLine";
import type { Food, Recipe } from "@/lib/types";
import { getFoodByBarcode, searchFoods } from "@/lib/off";
import { useCustomFoods, useFavorites, useRecents, useRecipes } from "@/lib/hooks";
import { recipePer100g } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

const BarcodeScanner = lazy(() => import("./BarcodeScanner").then((m) => ({ default: m.BarcodeScanner })));

type Tab = "recientes" | "favoritos" | "mios" | "recetas";

export const recipeAsFood = (r: Recipe): Food => ({
  id: `recipe:${r.id}`,
  name: r.name,
  brand: "Mi receta",
  per100g: recipePer100g(r),
});

interface Props {
  onPick: (food: Food) => void;
  onCreateCustom: () => void;
  showRecipes?: boolean;
}

export function FoodPicker({ onPick, onCreateCustom, showRecipes = true }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<Tab>("recientes");
  const { data: recents } = useRecents();
  const { data: favs } = useFavorites();
  const { data: custom } = useCustomFoods();
  const { data: recipes } = useRecipes();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const lc = term.toLowerCase();
        const mine = custom.filter((f) => f.name.toLowerCase().includes(lc));
        const off = await searchFoods(term, ctrl.signal);
        setResults([...mine, ...off]);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) toast.error("No se pudo buscar en Open Food Facts");
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, custom]);

  const handleCode = async (code: string) => {
    setScanning(false);
    const id = toast.loading(`Buscando ${code}…`);
    try {
      const food = await getFoodByBarcode(code);
      toast.dismiss(id);
      if (food) onPick(food);
      else toast.error("Producto no encontrado. Puedes crearlo a mano.", { action: { label: "Crear", onClick: onCreateCustom } });
    } catch {
      toast.dismiss(id);
      toast.error("Error consultando Open Food Facts");
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "recientes", label: "Recientes" },
    { id: "favoritos", label: "Favoritos" },
    { id: "mios", label: "Mis alimentos" },
    ...(showRecipes ? [{ id: "recetas" as Tab, label: "Recetas" }] : []),
  ];

  const list: Food[] = q.trim().length >= 2
    ? results
    : tab === "recientes"
      ? recents
      : tab === "favoritos"
        ? favs
        : tab === "mios"
          ? custom
          : recipes.map(recipeAsFood);

  return (
    <div className="space-y-3">
      <button className="btn-primary w-full min-h-14 text-base" onClick={() => setScanning(true)}>
        <ScanBarcode className="h-6 w-6" /> Escanear código de barras
      </button>

      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
        <input
          className="field pl-9"
          placeholder="Buscar alimento (ej. pechuga, skyr…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar alimento"
        />
        {loading && <Loader2 className="text-primary absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />}
      </div>

      {q.trim().length < 2 && (
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "min-h-9 shrink-0 border px-3 text-xs",
                tab === t.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <ul className="divide-border/40 divide-y">
        {list.map((f) => (
          <li key={f.id}>
            <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => onPick(f)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{f.name}</span>
                <span className="block truncate text-xs">
                  {f.brand && <span className="text-muted-foreground">{f.brand} · </span>}
                  <MacroLine m={f.per100g} /> <span className="text-muted-foreground">/100 g</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {list.length === 0 && !loading && (
        <p className="text-muted-foreground py-4 text-center text-sm">
          {q.trim().length >= 2 ? "Sin resultados." : "Aún no hay nada aquí."}
        </p>
      )}

      <button className="btn-ghost w-full" onClick={onCreateCustom}>
        <PackagePlus className="h-4 w-4" /> Crear alimento manual
      </button>

      <p className="text-muted-foreground text-center text-[10px]">Datos nutricionales de Open Food Facts (licencia ODbL)</p>

      {scanning && (
        <Suspense fallback={null}>
          <BarcodeScanner onDetected={handleCode} onClose={() => setScanning(false)} />
        </Suspense>
      )}
    </div>
  );
}
