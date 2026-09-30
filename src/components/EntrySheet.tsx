import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { GramsField } from "./GramsField";
import { MealSelect } from "./MealSelect";
import { MacroLine } from "./MacroLine";
import { MacroFields, macroStrings, parseMacroStrings } from "./MacroFields";
import type { DiaryEntry } from "@/lib/types";
import { scaleMacros } from "@/lib/nutrition";
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
  const [grams, setGrams] = useState(String(entry.grams));
  const [vals, setVals] = useState(macroStrings(entry.per100g));
  const [name, setName] = useState(entry.name);
  const [meal, setMeal] = useState(entry.meal);

  const g = parseFloat(grams) || 0;
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
          <p className="mb-4 text-xs">
            Total: <MacroLine m={scaleMacros(entry.per100g, g)} />
          </p>
        </>
      )}
      <div className="space-y-4">
        {quick ? <MacroFields value={vals} onChange={setVals} /> : <GramsField value={grams} onChange={setGrams} />}
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
