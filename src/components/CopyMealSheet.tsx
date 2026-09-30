import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Sheet } from "./Sheet";
import { MacroLine } from "./MacroLine";
import { mealLabel } from "./MealSelect";
import { MEALS, type DiaryEntry, type MealType } from "@/lib/types";
import { entryMacros, totalsFor } from "@/lib/nutrition";
import { addDaysISO, formatLongDate } from "@/lib/date";
import { useDay } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface Props {
  /** Día al que se copia. */
  date: string;
  /** Comida destino. Sin ella, se copia el día entero conservando cada comida. */
  meal?: MealType;
  onCopy: (entries: DiaryEntry[], meal?: MealType) => void;
  onClose: () => void;
}

type Source = MealType | "todo";

export function CopyMealSheet({ date, meal, onCopy, onClose }: Props) {
  const [from, setFrom] = useState(addDaysISO(date, -1));
  const [source, setSource] = useState<Source>(meal ?? "todo");
  const { data: day, isFetched } = useDay(from);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useEffect(() => setExcluded(new Set()), [from, source]);

  const available = MEALS.filter((m) => day.some((e) => e.meal === m.id));
  const list = source === "todo" ? day : day.filter((e) => e.meal === source);
  const chosen = list.filter((e) => !excluded.has(e.id));
  const toggle = (id: string) =>
    setExcluded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Sheet title={meal ? `Copiar a ${mealLabel(meal)}` : "Copiar de otro día"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label-sys" htmlFor="copy-from">Desde el día</label>
          <input id="copy-from" type="date" className="field" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          <p className="text-muted-foreground mt-1 text-[11px] capitalize">{formatLongDate(from)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["todo", ...MEALS.map((m) => m.id)] as Source[]).map((s) => {
            const has = s === "todo" ? day.length > 0 : available.some((m) => m.id === s);
            if (!has && s !== source) return null;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                aria-pressed={source === s}
                className={cn(
                  "min-h-11 border px-3 text-xs",
                  source === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
                )}
              >
                {s === "todo" ? "Todo el día" : mealLabel(s)}
              </button>
            );
          })}
        </div>

        {isFetched && list.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No hay nada registrado ahí.</p>
        ) : (
          <ul className="divide-border/40 divide-y">
            {list.map((e) => {
              const on = !excluded.has(e.id);
              return (
                <li key={e.id}>
                  <button type="button" className="flex w-full items-center gap-3 py-2 text-left" onClick={() => toggle(e.id)} aria-pressed={on}>
                    <span
                      className={cn("flex h-6 w-6 shrink-0 items-center justify-center border", on ? "border-primary text-primary" : "border-border text-transparent")}
                      aria-hidden="true"
                    >
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{e.name}</span>
                      <span className="block text-xs">
                        {source === "todo" && <span className="text-muted-foreground">{mealLabel(e.meal)} · </span>}
                        <MacroLine m={entryMacros(e)} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button
          className="btn-primary w-full"
          disabled={chosen.length === 0}
          onClick={() => onCopy(chosen, source === "todo" && !meal ? undefined : meal ?? (source as MealType))}
        >
          Copiar {chosen.length} · {Math.round(totalsFor(chosen).kcal)} kcal
        </button>
      </div>
    </Sheet>
  );
}
