import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet } from "./Sheet";
import type { Food } from "@/lib/types";
import { uid } from "@/lib/repos/local";

interface Props {
  food?: Food;
  onSave: (food: Food) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const FIELDS = [
  ["kcal", "Kcal"],
  ["protein", "Proteína (g)"],
  ["carbs", "Carbohidratos (g)"],
  ["fat", "Grasa (g)"],
] as const;

export function CustomFoodSheet({ food, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(food?.name ?? "");
  const [brand, setBrand] = useState(food?.brand ?? "");
  const [vals, setVals] = useState<Record<string, string>>({
    kcal: food ? String(food.per100g.kcal) : "",
    protein: food ? String(food.per100g.protein) : "",
    carbs: food ? String(food.per100g.carbs) : "",
    fat: food ? String(food.per100g.fat) : "",
  });
  const n = (k: string) => parseFloat((vals[k] ?? "").replace(",", ".")) || 0;
  const valid = name.trim().length > 1 && (n("kcal") > 0 || n("protein") > 0);

  return (
    <Sheet title={food ? "Editar alimento" : "Crear alimento"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSave({
            id: food?.id ?? `custom:${uid()}`,
            name: name.trim(),
            brand: brand.trim() || undefined,
            custom: true,
            per100g: { kcal: n("kcal"), protein: n("protein"), carbs: n("carbs"), fat: n("fat") },
          });
        }}
      >
        <div>
          <label className="label-sys" htmlFor="cf-name">
            Nombre
          </label>
          <input id="cf-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label-sys" htmlFor="cf-brand">
            Marca / origen (opcional)
          </label>
          <input id="cf-brand" className="field" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <p className="label-sys pt-2">Valores por 100 g</p>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(([k, l]) => (
            <div key={k}>
              <label className="label-sys" htmlFor={`cf-${k}`}>
                {l}
              </label>
              <input
                id={`cf-${k}`}
                className="field tabular-nums"
                inputMode="decimal"
                value={vals[k]}
                onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          {food && onDelete && (
            <button
              type="button"
              className="btn-ghost text-destructive"
              onClick={() => confirm("¿Borrar este alimento?") && onDelete(food.id)}
            >
              <Trash2 className="h-4 w-4" /> Borrar
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
