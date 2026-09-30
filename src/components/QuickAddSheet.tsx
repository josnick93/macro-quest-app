import { useState } from "react";
import { Sheet } from "./Sheet";
import { MealSelect } from "./MealSelect";
import { MacroFields, macroStrings, parseMacroStrings } from "./MacroFields";
import type { MealType } from "@/lib/types";
import { QUICK_ADD_NAME } from "@/lib/diary";

interface Props {
  meal: MealType;
  onSave: (meal: MealType, macros: ReturnType<typeof parseMacroStrings>, name: string) => void;
  onClose: () => void;
}

export function QuickAddSheet({ meal: initialMeal, onSave, onClose }: Props) {
  const [vals, setVals] = useState(macroStrings());
  const [name, setName] = useState("");
  const [meal, setMeal] = useState(initialMeal);
  const m = parseMacroStrings(vals);

  return (
    <Sheet title="Añadido rápido" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (m.kcal > 0) onSave(meal, m, name);
        }}
      >
        <MacroFields value={vals} onChange={setVals} autoFocus />
        <div>
          <label className="label-sys" htmlFor="qa-name">Descripción (opcional)</label>
          <input id="qa-name" className="field" placeholder={QUICK_ADD_NAME} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <MealSelect value={meal} onChange={setMeal} />
        <button type="submit" className="btn-primary w-full" disabled={m.kcal <= 0}>
          Añadir {m.kcal > 0 ? `${Math.round(m.kcal)} kcal` : ""}
        </button>
      </form>
    </Sheet>
  );
}
