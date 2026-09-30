import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysISO, formatLongDate, relativeDayLabel } from "@/lib/date";

/** Navegación ← día → con selector de calendario nativo al tocar la fecha. */
export function DatePager({ date, today, onChange }: { date: string; today: string; onChange: (d: string) => void }) {
  const label = relativeDayLabel(date, today);
  return (
    <header className="flex items-center gap-1">
      <button className="text-muted-foreground flex h-11 w-11 items-center justify-center" aria-label="Día anterior" onClick={() => onChange(addDaysISO(date, -1))}>
        <ChevronLeft className="h-6 w-6" />
      </button>
      <div className="relative min-w-0 flex-1 text-center">
        <h1 className="font-display truncate text-2xl leading-tight font-bold capitalize">{label}</h1>
        <p className="text-muted-foreground text-xs capitalize">{label === formatLongDate(date) ? "Cambiar día" : formatLongDate(date)}</p>
        {/* Input invisible encima del título: en iOS abre el calendario nativo */}
        <input
          type="date"
          aria-label="Elegir día"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </div>
      <button className="text-muted-foreground flex h-11 w-11 items-center justify-center" aria-label="Día siguiente" onClick={() => onChange(addDaysISO(date, 1))}>
        <ChevronRight className="h-6 w-6" />
      </button>
    </header>
  );
}
