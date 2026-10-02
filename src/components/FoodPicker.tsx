import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Loader2, PackagePlus, Plus, ScanBarcode, Search, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { MacroLine } from "./MacroLine";
import type { Food, SavedMeal } from "@/lib/types";
import { getFoodByBarcode, MIN_REMOTE_QUERY, searchFoods } from "@/lib/off";
import { repos } from "@/lib/repos";
import { defaultQuantity, formatQuantity, mergeSearch, quantityGrams, type SearchGroup } from "@/lib/foods";
import { scaleMacros, totalsFor } from "@/lib/nutrition";
import { useFoodLibrary, useSavedMeals } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const BarcodeScanner = lazy(() => import("./BarcodeScanner").then((m) => ({ default: m.BarcodeScanner })));

type Tab = "recientes" | "frecuentes" | "favoritos" | "mios" | "recetas" | "comidas";

const GROUP_LABEL: Record<SearchGroup, string> = {
  mine: "Mis alimentos",
  recipes: "Recetas",
  history: "Historial",
  off: "Open Food Facts",
};

const CONTINUOUS_KEY = "mq:continuousScan";
const readContinuous = () => {
  try {
    return localStorage.getItem(CONTINUOUS_KEY) === "1";
  } catch {
    return false;
  }
};

interface Props {
  /** diary: registrar en el diario · ingredient: elegir ingrediente de receta. */
  mode?: "diary" | "ingredient";
  onPick: (food: Food, opts: { fromScan: boolean }) => void;
  /** Si se indica, cada fila tiene un "+" que añade directamente con la cantidad habitual. */
  onQuickAdd?: (food: Food) => void;
  onCreateFood: (barcode?: string) => void;
  onPickSavedMeal?: (meal: SavedMeal) => void;
  /** Al cambiar, reabre el escáner si el escaneo continuo está activo y lo último vino del escáner. */
  scanResume?: number;
}

type RemoteState = "idle" | "loading" | "offline" | "error";

export function FoodPicker({ mode = "diary", onPick, onQuickAdd, onCreateFood, onPickSavedMeal, scanResume }: Props) {
  const diary = mode === "diary";
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Food[]>([]);
  const [remoteState, setRemoteState] = useState<RemoteState>("idle");
  const [scanning, setScanning] = useState(false);
  const [continuous, setContinuous] = useState(readContinuous);
  const lastFromScan = useRef(false);
  const lib = useFoodLibrary();
  const { data: savedMeals } = useSavedMeals();
  const [tab, setTab] = useState<Tab>("recientes");
  const term = q.trim();
  const searching = term.length >= 2;

  // Búsqueda remota con debounce; los resultados locales se muestran al instante.
  useEffect(() => {
    setRemote([]);
    if (term.length < MIN_REMOTE_QUERY) return setRemoteState("idle");
    if (!navigator.onLine) return setRemoteState("offline");
    const ctrl = new AbortController();
    setRemoteState("loading");
    const t = setTimeout(async () => {
      try {
        setRemote(await searchFoods(term, ctrl.signal));
        setRemoteState("idle");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRemoteState(navigator.onLine ? "error" : "offline");
      }
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, searching]);

  // Solo reacciona a scanResume: el resto se lee en ese momento.
  useEffect(() => {
    if (scanResume && continuous && lastFromScan.current) setScanning(true);
  }, [scanResume]);

  const pick = (food: Food, fromScan = false) => {
    lastFromScan.current = fromScan;
    onPick(food, { fromScan });
  };

  const handleCode = async (code: string) => {
    setScanning(false);
    lastFromScan.current = true;
    try {
      const local = await repos.foods.findByBarcode(code);
      if (local) return pick(local, true);
      const id = toast.loading(`Buscando ${code}…`);
      try {
        const food = await getFoodByBarcode(code);
        toast.dismiss(id);
        if (food) return pick(food, true);
        toast.info("Producto no encontrado: créalo con los datos de la etiqueta");
        onCreateFood(code);
      } catch {
        toast.dismiss(id);
        toast.error(navigator.onLine ? "Error consultando Open Food Facts" : "Sin conexión: puedes crearlo a mano", {
          action: { label: "Crear", onClick: () => onCreateFood(code) },
        });
      }
    } catch (e) {
      toast.error(`No se pudo buscar el código: ${String(e)}`);
    }
  };

  const tabs: { id: Tab; label: string; items: number }[] = [
    { id: "recientes", label: "Recientes", items: lib.recents.length },
    { id: "frecuentes", label: "Frecuentes", items: lib.frequent.length },
    { id: "favoritos", label: "Favoritos", items: lib.favorites.length },
    { id: "mios", label: "Mis alimentos", items: lib.mine.length },
    ...(diary
      ? [
          { id: "recetas" as Tab, label: "Recetas", items: lib.recipes.length },
          { id: "comidas" as Tab, label: "Comidas guardadas", items: savedMeals.length },
        ]
      : []),
  ];

  const tabFoods: Record<Exclude<Tab, "comidas">, Food[]> = {
    recientes: lib.recents,
    frecuentes: lib.frequent,
    favoritos: lib.favorites,
    mios: lib.mine,
    recetas: lib.recipes,
  };
  const localPool = diary ? lib.local : lib.local.filter((f) => f.source !== "recipe");
  const results = searching ? mergeSearch(term, localPool, remote, lib.stats.count) : [];

  const row = (f: Food) => {
    const qty = defaultQuantity(f, lib.stats.lastGrams[f.id]);
    return (
      <li key={f.id} className="flex items-center">
        <button className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 text-left" onClick={() => pick(f)}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{f.name}</span>
            <span className="block truncate text-xs">
              {f.brand && <span className="text-muted-foreground">{f.brand} · </span>}
              {f.edited && <span className="text-primary">corregido · </span>}
              {/* Macros de la cantidad que añade el «+» (ración habitual), no por 100 g. */}
              <MacroLine m={scaleMacros(f.per100g, quantityGrams(qty))} />
            </span>
          </span>
        </button>
        {onQuickAdd && (
          <button
            className="text-primary flex min-h-11 shrink-0 items-center gap-1 pl-2 text-[11px] tabular-nums"
            aria-label={`Añadir ${formatQuantity(qty)} de ${f.name}`}
            title={formatQuantity(qty)}
            onClick={() => onQuickAdd(f)}
          >
            <span className="text-muted-foreground">{Math.round(quantityGrams(qty))} g</span>
            <span className="border-primary/60 flex h-9 w-9 items-center justify-center border">
              <Plus className="h-5 w-5" />
            </span>
          </button>
        )}
      </li>
    );
  };

  const emptyText: Record<Tab, string> = {
    recientes: "Lo que registres aparecerá aquí.",
    frecuentes: "Aquí aparecerá lo que más registras.",
    favoritos: "Marca alimentos con la estrella para tenerlos a mano.",
    mios: "Crea alimentos con los datos de la etiqueta.",
    recetas: "Crea recetas en la pestaña Recetas.",
    comidas: "Guarda una comida desde el menú «⋯» del diario para registrarla de golpe.",
  };

  return (
    <div className="space-y-3">
      <button className="btn-primary min-h-14 w-full text-base" onClick={() => setScanning(true)}>
        <ScanBarcode className="h-6 w-6" /> Escanear código de barras
      </button>
      {diary && (
        <label className="text-muted-foreground flex min-h-11 items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="accent-primary h-4 w-4"
            checked={continuous}
            onChange={(e) => {
              setContinuous(e.target.checked);
              try {
                localStorage.setItem(CONTINUOUS_KEY, e.target.checked ? "1" : "0");
              } catch {
                /* sin almacenamiento: solo esta sesión */
              }
            }}
          />
          Escaneo continuo (vuelve a abrir la cámara tras añadir)
        </label>
      )}

      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
        <input
          className="field pl-9"
          placeholder="Buscar alimento (ej. pechuga, skyr…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar alimento"
          type="search"
        />
        {remoteState === "loading" && <Loader2 className="text-primary absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />}
      </div>

      {!searching && (
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn(
                "min-h-10 shrink-0 border px-3 text-xs",
                tab === t.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {t.label}
              {t.items > 0 && <span className="ml-1 opacity-60">{t.items}</span>}
            </button>
          ))}
        </div>
      )}

      {searching ? (
        <div>
          {results.length === 0 && remoteState !== "loading" && (
            <p className="text-muted-foreground py-4 text-center text-sm">Sin resultados.</p>
          )}
          {(["mine", "recipes", "history", "off"] as SearchGroup[]).map((g) => {
            const list = results.filter((r) => r.group === g);
            if (!list.length) return null;
            return (
              <section key={g}>
                <h3 className="label-sys mt-2">{GROUP_LABEL[g]}</h3>
                <ul className="divide-border/40 divide-y">{list.map((r) => row(r.food))}</ul>
              </section>
            );
          })}
          {remoteState === "offline" && (
            <p className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
              <WifiOff className="h-4 w-4" /> Sin conexión: solo resultados guardados en el dispositivo.
            </p>
          )}
          {remoteState === "error" && <p className="text-muted-foreground mt-2 text-xs">Open Food Facts no responde; se muestran solo resultados locales.</p>}
        </div>
      ) : tab === "comidas" ? (
        <ul className="divide-border/40 divide-y">
          {savedMeals.map((m) => {
            const t = totalsFor(m.items);
            return (
              <li key={m.id}>
                <button className="flex min-h-12 w-full items-center gap-3 py-2 text-left" onClick={() => onPickSavedMeal?.(m)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{m.name}</span>
                    <span className="block truncate text-xs">
                      <span className="text-muted-foreground">{m.items.length} alimentos · </span>
                      <MacroLine m={t} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="divide-border/40 divide-y">{tabFoods[tab].map(row)}</ul>
      )}

      {!searching && (tab === "comidas" ? savedMeals.length === 0 : tabFoods[tab].length === 0) && (
        <p className="text-muted-foreground py-4 text-center text-sm">{emptyText[tab]}</p>
      )}

      <button className="btn-ghost w-full" onClick={() => onCreateFood()}>
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
