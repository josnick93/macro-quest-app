import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { QuantityField } from "./QuantityField";
import { MicroList } from "./MicroList";
import { MealSelect } from "./MealSelect";
import { MacroLine } from "./MacroLine";
import { MacroFields, macroStrings, parseMacroStrings } from "./MacroFields";
import type { DiaryEntry } from "@/lib/types";
import { scaleMacros, scaleMicros } from "@/lib/nutrition";
import { defaultQuantity, quantityGrams, unitsFor } from "@/lib/foods";
import { useFoodLibrary } from "@/lib/hooks";
import { QUICK_ADD_NAME } from "@/lib/diary";

interface Props {
  entry: DiaryEntry;
  onSave: (e: DiaryEntry) => void;
  onDelete: (e: DiaryEntry) => void;
  onDuplicate: (e: DiaryEntry) => void;
  onClose: () => void;
}

export function EntrySheet({ entry, onSave, onDelete, onDuplicate, onClose }: Props) {
  const quick = entry.kind === "quick";
  const { known } = useFoodLibrary();
  // Las raciones salen del alimento actual; los valores, de la copia guardada en la entrada.
  const servings = (entry.foodId && known.get(entry.foodId)?.servings) || undefined;
  const [qty, setQty] = useState(() => defaultQuantity({ servings }, entry.grams));
  const [vals, setVals] = useState(macroStrings(entry.per100g));
  const [name, setName] = useState(entry.name);
  const [meal, setMeal] = useState(entry.meal);

  const g = quantityGrams(qty);
  const quickMacros = parseMacroStrings(vals);
  const draft: DiaryEntry = quick
    ? { ...entry, meal, name: name.trim() || QUICK_ADD_NAME, grams: 100, per100g: quickMacros }
    : { ...entry, meal, grams: g };
  const valid = quick ? quickMacros.kcal > 0 : g > 0;

  return (
    <Sheet title="Editar entrada" onClose={onClose}>
      {quick ? (
        <div className="mb-4">
          <label className="label-sys" htmlFor="es-name">Descripción</label>
          <input id="es-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      ) : (
        <>
          <p className="font-display text-xl leading-tight font-bold">{entry.name}</p>
          {entry.brand && <p className="text-muted-foreground text-sm">{entry.brand}</p>}
          <p className="text-xs">
            Total: <MacroLine m={scaleMacros(entry.per100g, g)} />
          </p>
          <MicroList micros={scaleMicros(entry.per100g, g)} />
          <div className="mb-4" />
        </>
      )}
      <div className="space-y-4">
        {quick ? <MacroFields value={vals} onChange={setVals} /> : <QuantityField units={unitsFor({ servings })} value={qty} onChange={setQty} />}
        <MealSelect value={meal} onChange={setMeal} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost" onClick={() => onDuplicate(draft)} disabled={!valid}>
            <Copy className="h-4 w-4" /> Duplicar
          </button>
          <button type="button" className="btn-ghost text-destructive" onClick={() => onDelete(entry)}>
            <Trash2 className="h-4 w-4" /> Borrar
          </button>
        </div>
        <button className="btn-primary w-full" disabled={!valid} onClick={() => onSave(draft)}>
          Guardar
        </button>
      </div>
    </Sheet>
  );
}
