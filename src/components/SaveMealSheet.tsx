import { useState } from "react";
import { Sheet } from "./Sheet";
import { MacroLine } from "./MacroLine";
import { totalsFor } from "@/lib/nutrition";
import type { DiaryEntry } from "@/lib/types";

/** Guardar las entradas de una comida del diario como plantilla reutilizable. */
export function SaveMealSheet({
  entries,
  defaultName,
  onSave,
  onClose,
}: {
  entries: DiaryEntry[];
  defaultName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  return (
    <Sheet title="Guardar comida" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <div>
          <label className="label-sys" htmlFor="sm-name">Nombre</label>
          <input id="sm-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
        </div>
        <p className="text-xs">
          <span className="text-muted-foreground">{entries.length} alimentos · </span>
          <MacroLine m={totalsFor(entries)} />
        </p>
        <button type="submit" className="btn-primary w-full" disabled={!name.trim()}>
          Guardar
        </button>
      </form>
    </Sheet>
  );
}
