import { Dumbbell, ExternalLink, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { SystemWindow } from "@/components/SystemWindow";
import { relativeDayLabel } from "@/lib/date";
import { FUERZA_URL } from "@/lib/fuerzaApi";
import { useFuerza, useToday } from "@/lib/hooks";

const kg = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;

/** Resumen semanal de Cazador de Fuerza (app hermana, misma cuenta). Solo con sesión. */
export function FuerzaWindow() {
  const today = useToday();
  const { loaded, connected, summary } = useFuerza();
  if (!loaded) return null;

  const open = (
    <a className="btn-ghost min-h-9 px-3 text-xs" href={FUERZA_URL} target="_blank" rel="noopener">
      Abrir <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );

  if (!summary) {
    return (
      <SystemWindow title="Fuerza" action={open} scan={false}>
        <p className="text-muted-foreground text-xs">
          {connected
            ? "No hay entrenos en Cazador de Fuerza en las últimas semanas."
            : "¿Entrenas fuerza? Cazador de Fuerza usa esta misma cuenta y cruza tus entrenos con lo que comes y lo que pesas."}
        </p>
      </SystemWindow>
    );
  }

  const planned = summary.plannedPerWeek;
  const progress = planned ? Math.min(100, (summary.weekSessions / planned) * 100) : 0;

  return (
    <SystemWindow title="Fuerza esta semana" action={open}>
      <div className="flex items-baseline gap-2">
        <Dumbbell className="text-primary h-4 w-4 self-center" />
        <span className="font-display neon-text text-3xl font-bold tabular-nums">
          {summary.weekSessions}
          {planned ? <span className="text-muted-foreground text-lg">/{planned}</span> : null}
        </span>
        <span className="text-muted-foreground text-xs">{summary.weekSessions === 1 ? "entreno" : "entrenos"}</span>
        {summary.weekPrs > 0 && (
          <span className="text-success ml-auto inline-flex items-center gap-1 text-xs font-semibold">
            <Trophy className="h-3.5 w-3.5" /> {summary.weekPrs} {summary.weekPrs === 1 ? "récord" : "récords"}
          </span>
        )}
      </div>
      {planned ? (
        <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Entrenos de la semana">
          <div className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      {summary.lifts.length > 0 && (
        <ul className="border-border mt-3 space-y-1.5 border-t pt-3 text-sm">
          {summary.lifts.map((lift) => (
            <li key={lift.id} className="flex items-center gap-2">
              <span className="flex-1">{lift.label}</span>
              <span className="font-semibold tabular-nums">{kg(lift.e1rm)} kg</span>
              {lift.changePct === null ? (
                <span className="text-muted-foreground w-16 text-right text-xs">—</span>
              ) : (
                <span className={`inline-flex w-16 items-center justify-end gap-0.5 text-xs tabular-nums ${lift.changePct >= 0 ? "text-primary" : "text-over"}`}>
                  {lift.changePct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {pct(lift.changePct)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground mt-2 text-[11px]">
        e1RM: 1RM estimado · cambio en 2 semanas
        {summary.lastWorkout && ` · último: ${summary.lastWorkout.title}, ${relativeDayLabel(summary.lastWorkout.date, today).toLowerCase()}`}
      </p>
    </SystemWindow>
  );
}
