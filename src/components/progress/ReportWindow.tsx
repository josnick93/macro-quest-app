import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SystemWindow } from "@/components/SystemWindow";
import { Seg } from "@/components/ProfileControls";
import { addDaysISO, formatShortDate } from "@/lib/date";
import { calcTargets } from "@/lib/nutrition";
import { dayStats, report, type DayStatus } from "@/lib/progress";
import { useDiaryRange, useProfile, useToday } from "@/lib/hooks";
import { axis, GRID, tip } from "./chart";

type Period = "7" | "30";
const PERIODS: [Period, string][] = [
  ["7", "7 días"],
  ["30", "30 días"],
];

/** Pasarse va en ámbar, nunca en rojo. */
const BAR_COLOR: Record<DayStatus, string> = { none: "var(--primary)", under: "var(--primary)", met: "var(--success)", over: "var(--over)" };

function Stat({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div>
      <p className={`font-display text-xl font-bold tabular-nums ${className ?? ""}`}>{value}</p>
      <p className="label-sys">{label}</p>
    </div>
  );
}

export function ReportWindow() {
  const today = useToday();
  const [period, setPeriod] = useState<Period>("7");
  const from = addDaysISO(today, -(Number(period) - 1));
  const { data: entries, isFetching } = useDiaryRange(from, today);
  const { data: profile } = useProfile();

  const stats = useMemo(() => dayStats(entries, from, today, (d) => calcTargets(profile, d)), [entries, from, today, profile]);
  const r = useMemo(() => report(entries, stats), [entries, stats]);
  const bars = stats.map((s) => ({ d: formatShortDate(s.date), kcal: Math.round(s.kcal), status: s.status }));
  const target = calcTargets(profile).kcal;

  return (
    <SystemWindow title="Informe">
      <Seg value={period} options={PERIODS} onChange={setPeriod} />
      {r.logged === 0 ? (
        // Mientras se lee el periodo no se dice que está vacío.
        <p className="text-muted-foreground py-6 text-center text-xs">{isFetching ? "\u00a0" : "Aún no hay nada registrado en este periodo."}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat value={String(r.avg.kcal)} label="kcal/día" />
            <Stat value={`${r.logged}/${r.days}`} label="registrados" />
            <Stat value={`${r.met}/${r.logged}`} label="en objetivo" className="text-success" />
          </div>
          <p className="text-muted-foreground mt-2 text-center text-[11px]">
            Media de los días registrados · objetivo {r.avgTarget.kcal} kcal
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
            <p>
              <span className="text-protein font-semibold">{r.avg.protein}</span>
              <span className="text-muted-foreground"> / {r.avgTarget.protein} g prot</span>
            </p>
            <p>
              <span className="text-carbs font-semibold">{r.avg.carbs}</span>
              <span className="text-muted-foreground"> / {r.avgTarget.carbs} g carb</span>
            </p>
            <p>
              <span className="text-fat font-semibold">{r.avg.fat}</span>
              <span className="text-muted-foreground"> / {r.avgTarget.fat} g grasa</span>
            </p>
          </div>

          <div className="mt-3 h-40">
            <ResponsiveContainer>
              <BarChart data={bars} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="d" {...axis} minTickGap={16} />
                <YAxis {...axis} domain={[0, (max: number) => Math.max(max, target) * 1.1]} tickFormatter={(v: number) => String(Math.round(v))} />
                <Tooltip {...tip} cursor={{ fill: "oklch(0.3 0.04 256 / 0.3)" }} formatter={(v) => [`${v} kcal`, "Energía"]} />
                <ReferenceLine y={target} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                <Bar dataKey="kcal" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {bars.map((b) => (
                    <Cell key={b.d} fill={BAR_COLOR[b.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-muted-foreground mt-1 text-[11px]">Línea discontinua: objetivo actual ({target} kcal) · verde: dentro del ±10 %</p>

          <h3 className="label-sys mt-4 mb-2">Reparto por comida</h3>
          <ul className="space-y-1.5">
            {r.meals.map((m) => (
              <li key={m.meal} className="text-xs">
                <div className="flex justify-between">
                  <span>{m.label}</span>
                  <span className="text-muted-foreground tabular-nums">{m.pct} %</span>
                </div>
                <div className="bg-muted mt-1 h-1.5">
                  <div className="bg-primary h-full" style={{ width: `${m.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>

          {r.top.length > 0 && (
            <>
              <h3 className="label-sys mt-4 mb-2">Lo que más has comido</h3>
              <ol className="divide-border divide-y text-xs">
                {r.top.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {f.times} {f.times === 1 ? "vez" : "veces"} · {f.kcal} kcal
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </SystemWindow>
  );
}
