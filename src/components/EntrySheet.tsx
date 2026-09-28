import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { GramsField } from "./GramsField";
import { MealSelect } from "./MealSelect";
import { MacroLine } from "./MacroLine";
import type { DiaryEntry } from "@/lib/types";
import { scaleMacros } from "@/lib/nutrition";

interface Props {
  entry: DiaryEntry;
  onSave: (e: DiaryEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function EntrySheet({ entry, onSave, onDelete, onClose }: Props) {
  const [grams, setGrams] = useState(String(entry.grams));
  const [meal, setMeal] = useState(entry.meal);
  const g = parseFloat(grams) || 0;

  return (
    <Sheet title="Editar entrada" onClose={onClose}>
      <p className="font-display text-xl font-bold">{entry.name}</p>
      <p className="mb-4 text-xs">
        Total: <MacroLine m={scaleMacros(entry.per100g, g)} />
      </p>
      <div className="space-y-4">
        <GramsField value={grams} onChange={setGrams} />
        <MealSelect value={meal} onChange={setMeal} />
        <div className="flex gap-2">
          <button
            className="btn-ghost text-destructive"
            onClick={() => confirm(`¿Borrar "${entry.name}"?`) && onDelete(entry.id)}
          >
            <Trash2 className="h-4 w-4" /> Borrar
          </button>
          <button className="btn-primary flex-1" disabled={g <= 0} onClick={() => onSave({ ...entry, grams: g, meal })}>
            Guardar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
