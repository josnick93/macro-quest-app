import { Lock, Trophy } from "lucide-react";
import { SystemWindow } from "@/components/SystemWindow";
import { ACHIEVEMENTS } from "@/lib/gamification";
import { cn } from "@/lib/utils";

const formatDate = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "";
};

/** Logros: los conseguidos primero, con su fecha; los pendientes dicen cómo conseguirlos. */
export function AchievementsWindow({ unlocked }: { unlocked: Record<string, string> }) {
  const done = ACHIEVEMENTS.filter((a) => unlocked[a.id]);
  const list = [...done, ...ACHIEVEMENTS.filter((a) => !unlocked[a.id])];
  return (
    <SystemWindow
      title="Logros"
      scan={false}
      action={
        <span className="text-muted-foreground text-xs tabular-nums">
          {done.length}/{ACHIEVEMENTS.length}
        </span>
      }
    >
      <ul className="divide-border/40 divide-y">
        {list.map((a) => {
          const date = unlocked[a.id];
          return (
            <li key={a.id} className="flex items-center gap-3 py-2">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center border",
                  date ? "border-primary bg-primary/15 text-primary shadow-[0_0_12px_oklch(0.72_0.16_250/40%)]" : "border-border text-muted-foreground/60",
                )}
                aria-hidden="true"
              >
                {date ? <Trophy className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", !date && "text-muted-foreground")}>{a.title}</span>
                <span className="text-muted-foreground block text-xs">{date ? `Conseguido el ${formatDate(date)}` : a.description}</span>
              </span>
              <span className={cn("font-display shrink-0 text-xs tracking-widest", date ? "text-muted-foreground" : "text-primary")}>+{a.xp} XP</span>
            </li>
          );
        })}
      </ul>
    </SystemWindow>
  );
}
