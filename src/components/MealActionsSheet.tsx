import { CalendarSearch, CopyPlus, Zap } from "lucide-react";
import { Sheet } from "./Sheet";
import { mealLabel } from "./MealSelect";
import type { DiaryEntry, MealType } from "@/lib/types";
import { totalsFor } from "@/lib/nutrition";

interface Props {
  meal: MealType;
  /** Entradas de esa comida el día anterior. */
  previous: DiaryEntry[];
  previousLabel: string;
  onCopyPrevious: () => void;
  onCopyOther: () => void;
  onQuickAdd: () => void;
  onClose: () => void;
}

export function MealActionsSheet({ meal, previous, previousLabel, onCopyPrevious, onCopyOther, onQuickAdd, onClose }: Props) {
  return (
    <Sheet title={mealLabel(meal)} onClose={onClose}>
      <div className="space-y-2">
        <button className="btn-ghost w-full justify-start" disabled={previous.length === 0} onClick={onCopyPrevious}>
          <CopyPlus className="h-4 w-4" />
          <span className="flex-1 text-left">Copiar {mealLabel(meal).toLowerCase()} {previousLabel}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {previous.length > 0 ? `${previous.length} · ${Math.round(totalsFor(previous).kcal)} kcal` : "vacío"}
          </span>
        </button>
        <button className="btn-ghost w-full justify-start" onClick={onCopyOther}>
          <CalendarSearch className="h-4 w-4" /> Copiar de otro día…
        </button>
        <button className="btn-ghost w-full justify-start" onClick={onQuickAdd}>
          <Zap className="h-4 w-4" /> Añadido rápido
        </button>
      </div>
    </Sheet>
  );
}
