import { Flame } from "lucide-react";
import { levelProgress } from "@/lib/xp";

export function XPBar({ xp, streak }: { xp: number; streak: number }) {
  const { level, current, needed, pct } = levelProgress(xp);
  return (
    <div className="system-window flex items-center gap-3 px-4 py-3">
      <div className="border-primary/60 bg-primary/10 flex h-11 w-11 shrink-0 items-center justify-center border">
        <span className="font-display neon-text text-xl leading-none font-bold">{level}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between text-[11px]">
          <span className="font-display tracking-[0.2em] uppercase">Nivel {level}</span>
          <span className="text-muted-foreground tabular-nums">
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
      </div>
    </div>
  );
}
