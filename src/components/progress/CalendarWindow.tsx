import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SystemWindow } from "@/components/SystemWindow";
import { calcTargets } from "@/lib/nutrition";
import { addMonths, dayStats, formatMonth, monthEnd, monthGrid, monthOf, monthStart, type DayStatus } from "@/lib/progress";
import { useDiaryRange, useProfile, useToday } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

/** Pasarse va en ámbar, nunca en rojo. */
const STYLE: Record<DayStatus, string> = {
  none: "border-border/60 text-muted-foreground",
  under: "border-primary/60 bg-primary/15 text-foreground",
  met: "border-success bg-success/25 text-success",
  over: "border-over bg-over/20 text-over",
};
const LEGEND: [DayStatus, string][] = [
  ["met", "En objetivo"],
  ["under", "Por debajo"],
  ["over", "Por encima"],
  ["none", "Sin registro"],
];
const STATUS_TEXT: Record<DayStatus, string> = { none: "sin registro", under: "por debajo del objetivo", met: "en objetivo", over: "por encima del objetivo" };

export function CalendarWindow() {
  const today = useToday();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => monthOf(today));
  const from = monthStart(month);
  const to = monthEnd(month);
  const { data: entries } = useDiaryRange(from, to);
  const { data: profile } = useProfile();

  const byDate = useMemo(
    () => new Map(dayStats(entries, from, to, (d) => calcTargets(profile, d)).map((s) => [s.date, s])),
    [entries, from, to, profile],
  );
  const isCurrent = month === monthOf(today);

  return (
    <SystemWindow title="Calendario">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="btn-ghost min-h-11 px-3" aria-label="Mes anterior" onClick={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-base font-semibold">{formatMonth(month)}</p>
        <button
          type="button"
          className="btn-ghost min-h-11 px-3 disabled:opacity-30"
          aria-label="Mes siguiente"
          disabled={isCurrent}
          onClick={() => setMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="label-sys">
            {d}
          </span>
        ))}
        {monthGrid(month).map((date, i) => {
          if (!date) return <span key={`hueco-${i}`} />;
          const day = Number(date.slice(8));
          if (date > today) {
            return (
              <span key={date} className="text-muted-foreground/40 flex min-h-11 items-center justify-center text-xs tabular-nums">
                {day}
              </span>
            );
          }
          const stat = byDate.get(date);
          const status = stat?.status ?? "none";
          return (
            <button
              key={date}
              type="button"
              aria-label={`Día ${day}: ${STATUS_TEXT[status]}${stat && status !== "none" ? `, ${Math.round(stat.kcal)} kcal` : ""}`}
              className={cn("min-h-11 border text-xs tabular-nums", STYLE[status], date === today && "ring-primary ring-1 ring-offset-0")}
              onClick={() => navigate(date === today ? "/" : `/?fecha=${date}`)}
            >
              {day}
            </button>
          );
        })}
      </div>
      <ul className="text-muted-foreground mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {LEGEND.map(([status, label]) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={cn("inline-block h-3 w-3 border", STYLE[status])} /> {label}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-2 text-[11px]">Toca un día para abrirlo en el diario. Se compara con tu objetivo actual.</p>
    </SystemWindow>
  );
}
