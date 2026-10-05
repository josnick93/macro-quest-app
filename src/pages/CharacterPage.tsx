import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SystemWindow } from "@/components/SystemWindow";
import { ACHIEVEMENTS } from "@/lib/gamification";
import { FORM_DAYS, levelTitle, type Stat } from "@/lib/character";
import { levelProgress, shieldedStreak } from "@/lib/xp";
import { useCharacter, useGame, useToday } from "@/lib/hooks";

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[oklch(0.25_0.04_256)]">
      <div className="bar-glow bg-primary text-primary h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function StatRow({ stat }: { stat: Stat }) {
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <span className="border-primary/60 bg-primary/10 font-display neon-text flex h-10 w-12 shrink-0 items-center justify-center border text-sm font-bold tracking-widest">
          {stat.abbr}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-sm">{stat.name}</span>
            <span className="font-display text-sm font-bold tabular-nums">Nv {stat.level}</span>
          </div>
          <Bar pct={(stat.current / stat.needed) * 100} />
          <div className="text-muted-foreground mt-1 flex justify-between gap-2 text-[11px]">
            <span className="min-w-0">{stat.rule}</span>
            <span className="shrink-0 tabular-nums">
              {stat.current}/{stat.needed}
            </span>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground mt-1 pl-15 text-[11px]">
        Forma: <span className="text-foreground tabular-nums">{stat.form}%</span> de los días
      </p>
    </li>
  );
}

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      <p className="label-sys">{label}</p>
    </div>
  );
}

/** Ficha de personaje: nivel, título, atributos sacados de los hábitos y resumen de todo el historial. */
export function CharacterPage() {
  const today = useToday();
  const { data: game } = useGame();
  const sheet = useCharacter(today);
  const { level, current, needed, pct } = levelProgress(game.xp);
  const { streak } = shieldedStreak(game.activeDays, today);
  const achievements = ACHIEVEMENTS.filter((a) => game.achievements[a.id]).length;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2 px-1">
        <Link to="/" className="text-muted-foreground -ml-2 flex h-11 w-11 items-center justify-center" aria-label="Volver a Hoy">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">Ficha de personaje</h1>
          <p className="text-muted-foreground text-xs">Lo que dicen tus hábitos</p>
        </div>
      </header>

      <SystemWindow>
        <div className="flex items-center gap-4">
          <div className="border-primary/60 bg-primary/10 flex h-16 w-16 shrink-0 flex-col items-center justify-center border">
            <span className="label-sys leading-none">Nv</span>
            <span className="font-display neon-text text-3xl leading-none font-bold">{level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold tracking-[0.15em] uppercase">{levelTitle(level)}</p>
            <div className="text-muted-foreground mb-1 flex justify-between text-[11px] tabular-nums">
              <span>{Math.round(game.xp)} XP en total</span>
              <span>
                {current} / {needed}
              </span>
            </div>
            <Bar pct={pct} />
          </div>
        </div>
      </SystemWindow>

      <SystemWindow title="Atributos" scan={false}>
        {sheet ? (
          <>
            <ul className="divide-border/40 -my-3 divide-y">
              {sheet.stats.map((s) => (
                <StatRow key={s.id} stat={s} />
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-[11px]">
              Los atributos suben con cada día que cumples y nunca bajan. La forma mira los últimos {FORM_DAYS} días.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Calculando…</p>
        )}
      </SystemWindow>

      <SystemWindow title="Historial" scan={false}>
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 text-center">
          <Figure value={streak} label="racha" />
          <Figure value={sheet?.bestStreak ?? "–"} label="mejor racha" />
          <Figure value={game.activeDays.length} label="días activos" />
          <Figure value={`${achievements}/${ACHIEVEMENTS.length}`} label="logros" />
          <Figure value={sheet?.weeklyDone ?? "–"} label="semanales" />
          <Figure value={sheet?.entries ?? "–"} label="registros" />
        </div>
      </SystemWindow>
    </div>
  );
}
