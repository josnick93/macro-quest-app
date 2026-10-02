import { SystemWindow } from "@/components/SystemWindow";
import { XPBar } from "@/components/XPBar";
import { CalendarWindow } from "@/components/progress/CalendarWindow";
import { ReportWindow } from "@/components/progress/ReportWindow";
import { WeightWindow } from "@/components/progress/WeightWindow";
import { AchievementsWindow } from "@/components/progress/AchievementsWindow";
import { shieldedStreak } from "@/lib/xp";
import { useGame, useToday } from "@/lib/hooks";

export function ProgressPage() {
  const today = useToday();
  const { data: game } = useGame();
  const { streak } = shieldedStreak(game.activeDays, today);

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-2xl font-bold">Progreso</h1>
        <p className="text-muted-foreground text-xs">Estadísticas del jugador</p>
      </header>

      <XPBar xp={game.xp} activeDays={game.activeDays} today={today} />
      <WeightWindow />
      <ReportWindow />
      <CalendarWindow />
      <AchievementsWindow unlocked={game.achievements} />

      <SystemWindow title="Registro de nivel">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-display text-xl font-bold tabular-nums">{Math.round(game.xp)}</p>
            <p className="label-sys">XP total</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold tabular-nums">{streak}</p>
            <p className="label-sys">racha</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold tabular-nums">{game.activeDays.length}</p>
            <p className="label-sys">días activos</p>
          </div>
        </div>
      </SystemWindow>
    </div>
  );
}
