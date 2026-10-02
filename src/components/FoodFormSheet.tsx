import { useState } from "react";
import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Sheet } from "./Sheet";
import { MICROS, type Food, type Nutrients, type Serving } from "@/lib/types";
import { uid } from "@/lib/repos/local";

interface Props {
  /** Alimento a editar (propio) o a corregir (Open Food Facts). Sin él, se crea uno nuevo. */
  food?: Food | undefined;
  /** Código escaneado que no existe: se asocia al alimento nuevo. */
  barcode?: string | undefined;
  onSave: (food: Food) => void;
  /** Borrar (propio) o descartar la corrección (OFF). */
  onDelete?: (food: Food) => void;
  onClose: () => void;
}

const MACRO_FIELDS = [
  ["kcal", "Kcal"],
  ["protein", "Proteína (g)"],
  ["carbs", "Carbohidratos (g)"],
  ["fat", "Grasa (g)"],
] as const;

type NutrientKey = keyof Nutrients;
const toStr = (v: number | undefined) => (v === undefined ? "" : String(v));
const parse = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function FoodFormSheet({ food, barcode, onSave, onDelete, onClose }: Props) {
  const isOff = food?.source === "off";
  const [name, setName] = useState(food?.name ?? "");
  const [brand, setBrand] = useState(food?.brand ?? "");
  const [code, setCode] = useState(food?.barcode ?? barcode ?? "");
  const [vals, setVals] = useState<Record<NutrientKey, string>>(() => {
    const p = food?.per100g;
    return {
      kcal: toStr(p?.kcal),
      protein: toStr(p?.protein),
      carbs: toStr(p?.carbs),
      fat: toStr(p?.fat),
      fiber: toStr(p?.fiber),
      sugar: toStr(p?.sugar),
      satFat: toStr(p?.satFat),
      salt: toStr(p?.salt),
    };
  });
  const [servings, setServings] = useState<{ label: string; grams: string }[]>(
    (food?.servings ?? []).map((s) => ({ label: s.label, grams: String(s.grams) })),
  );
  const [showMicros, setShowMicros] = useState(MICROS.some(({ key }) => food?.per100g[key] !== undefined));

  const valid = name.trim().length > 1 && ((parse(vals.kcal) ?? 0) > 0 || (parse(vals.protein) ?? 0) > 0);
  const field = (k: NutrientKey, label: string) => (
    <div key={k}>
      <label className="label-sys" htmlFor={`ff-${k}`}>{label}</label>
      <input
        id={`ff-${k}`}
        className="field tabular-nums"
        inputMode="decimal"
        value={vals[k]}
        onChange={(e) => setVals({ ...vals, [k]: e.target.value.replace(/[^\d.,]/g, "") })}
      />
    </div>
  );

  const submit = () => {
    const per100g: Nutrients = {
      kcal: parse(vals.kcal) ?? 0,
      protein: parse(vals.protein) ?? 0,
      carbs: parse(vals.carbs) ?? 0,
      fat: parse(vals.fat) ?? 0,
    };
    for (const { key } of MICROS) {
      const v = parse(vals[key]);
      if (v !== undefined) per100g[key] = v;
    }
    const sv: Serving[] = servings.flatMap((s) => {
      const grams = parse(s.grams) ?? 0;
      return s.label.trim() && grams > 0 ? [{ label: s.label.trim(), grams }] : [];
    });
    onSave({
      id: food?.id ?? `custom:${uid()}`,
      name: name.trim(),
      brand: brand.trim() || undefined,
      barcode: code.trim() || undefined,
      per100g,
      servings: sv.length ? sv : undefined,
      source: food?.source ?? "custom",
      ...(isOff ? { edited: true } : {}),
    });
  };

  return (
    <Sheet title={isOff ? "Corregir datos" : food ? "Editar alimento" : "Crear alimento"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) submit();
        }}
      >
        {isOff && (
          <p className="text-muted-foreground border-border border p-2 text-[11px]">
            Producto de Open Food Facts. Tus cambios son solo para ti y se usarán en lugar de los datos originales.
          </p>
        )}
        <div>
          <label className="label-sys" htmlFor="ff-name">Nombre</label>
          <input id="ff-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!food} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-sys" htmlFor="ff-brand">Marca (opcional)</label>
            <input id="ff-brand" className="field" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <label className="label-sys" htmlFor="ff-code">Código de barras</label>
            <input
              id="ff-code"
              className="field tabular-nums"
              inputMode="numeric"
              value={code}
              disabled={isOff}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>

        <p className="label-sys pt-2">Valores por 100 g</p>
        <div className="grid grid-cols-2 gap-3">{MACRO_FIELDS.map(([k, l]) => field(k, l))}</div>

        {showMicros ? (
          <div className="grid grid-cols-2 gap-3">{MICROS.map(({ key, label }) => field(key, `${label} (g)`))}</div>
        ) : (
          <button type="button" className="text-primary min-h-11 text-xs" onClick={() => setShowMicros(true)}>
            + Fibra, azúcares, grasa saturada y sal
          </button>
        )}

        <div>
          <div className="flex items-center justify-between">
            <span className="label-sys mb-0">Raciones y unidades</span>
            <button
              type="button"
              className="text-primary flex min-h-11 items-center gap-1 text-xs"
              onClick={() => setServings([...servings, { label: "", grams: "" }])}
            >
              <Plus className="h-4 w-4" /> Añadir
            </button>
          </div>
          {servings.length === 0 && <p className="text-muted-foreground text-[11px]">Ej.: «1 yogur» = 125 g, «rebanada» = 30 g.</p>}
          <ul className="space-y-2">
            {servings.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  className="field flex-1"
                  placeholder="1 yogur"
                  aria-label="Nombre de la ración"
                  value={s.label}
                  onChange={(e) => setServings(servings.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  className="field w-20 text-right tabular-nums"
                  inputMode="decimal"
                  placeholder="g"
                  aria-label="Gramos de la ración"
                  value={s.grams}
                  onChange={(e) => setServings(servings.map((x, j) => (j === i ? { ...x, grams: e.target.value.replace(/[^\d.,]/g, "") } : x)))}
                />
                <span className="text-muted-foreground text-xs">g</span>
                <button
                  type="button"
                  aria-label="Quitar ración"
                  className="text-muted-foreground flex h-11 w-9 items-center justify-center"
                  onClick={() => setServings(servings.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2 pt-2">
          {food && onDelete && (food.source === "custom" || food.edited) && (
            <button
              type="button"
              className="btn-ghost text-destructive"
              onClick={() => confirm(isOff ? "¿Descartar tu corrección y volver a los datos de Open Food Facts?" : "¿Borrar este alimento?") && onDelete(food)}
            >
              {isOff ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />} {isOff ? "Original" : "Borrar"}
            </button>
          )}
          <button type="submit" className="btn-primary flex-1" disabled={!valid}>
            Guardar
          </button>
        </div>
      </form>
    </Sheet>
  );
}
