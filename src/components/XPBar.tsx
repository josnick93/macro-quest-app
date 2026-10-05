import { Link } from "react-router-dom";
import { Flame, Shield } from "lucide-react";
import { levelProgress, shieldedStreak } from "@/lib/xp";
import { levelTitle } from "@/lib/character";
import { cn } from "@/lib/utils";

/** Nivel, XP y racha; abre la ficha de personaje. El escudo perdona un día sin registro por semana. */
export function XPBar({ xp, activeDays, today }: { xp: number; activeDays: readonly string[]; today: string }) {
  const { level, current, needed, pct } = levelProgress(xp);
  const { streak, shieldReady } = shieldedStreak(activeDays, today);
  return (
    <Link to="/ficha" className="system-window flex items-center gap-3 px-4 py-3 active:opacity-80">
      <div className="border-primary/60 bg-primary/10 flex h-11 w-11 shrink-0 items-center justify-center border">
        <span className="font-display neon-text text-xl leading-none font-bold">{level}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between text-[11px]">
          <span className="font-display truncate tracking-[0.2em] uppercase">
            <span className="sr-only">Nivel {level}, </span>
            {levelTitle(level)}
          </span>
          <span className="text-muted-foreground shrink-0 pl-2 tabular-nums">
            {current} / {needed} XP
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[oklch(0.25_0.04_256)]">
          <div className="bar-glow bg-primary text-primary h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-sm">
        <Flame className="text-carbs h-4 w-4" aria-hidden="true" />
        <span className="tabular-nums">{streak}</span>
        <span className="sr-only">días de racha</span>
        {streak > 0 && (
          <>
            <Shield className={cn("ml-1 h-4 w-4", shieldReady ? "text-primary fill-primary/30" : "text-muted-foreground/50")} aria-hidden="true" />
            <span className="sr-only">{shieldReady ? "Escudo de racha disponible" : "Escudo de racha gastado esta semana"}</span>
          </>
        )}
      </div>
    </Link>
  );
}
