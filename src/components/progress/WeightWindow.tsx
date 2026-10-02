import { useMemo, useState } from "react";
import { Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SystemWindow } from "@/components/SystemWindow";
import { Sheet } from "@/components/Sheet";
import { Seg, signed } from "@/components/ProfileControls";
import { addDaysISO, diffDays, formatShortDate } from "@/lib/date";
import { projectTarget, TREND_MIN_WEIGHINS, weightSeries, weightTrend } from "@/lib/progress";
import { useProfile, useProfileSet, useRemoveWeight, useSaveProfile, useSaveWeight, useToday, useWeights } from "@/lib/hooks";
import { axis, GRID, tip } from "./chart";

type Period = "30" | "90" | "all";
const PERIODS: [Period, string][] = [
  ["30", "30 días"],
  ["90", "90 días"],
  ["all", "Todo"],
];

export function WeightWindow() {
  const today = useToday();
  const { data: weights } = useWeights();
  const { data: profile } = useProfile();
  const profileSet = useProfileSet();
  const saveWeight = useSaveWeight();
  const saveProfile = useSaveProfile();
  const removeWeight = useRemoveWeight();
  const [period, setPeriod] = useState<Period>("90");
  const [open, setOpen] = useState(false);
  const [wDate, setWDate] = useState(today);
  const [kg, setKg] = useState("");

  const series = useMemo(() => weightSeries(weights), [weights]);
  const last = series[series.length - 1];
  const from = period === "all" ? "" : addDaysISO(today, -Number(period));
  const shown = series.filter((p) => p.date >= from);
  const origin = shown[0]?.date ?? today;
  const data = shown.map((p) => ({ x: diffDays(origin, p.date), kg: p.kg, avg: p.avg }));
  const change = shown.length >= 2 ? Math.round((shown[shown.length - 1]!.avg - shown[0]!.avg) * 10) / 10 : null;

  const trend = useMemo(() => weightTrend(weights, today), [weights, today]);
  const planRate = profile.goal === "perder" ? -profile.rateKgWeek : profile.goal === "ganar" ? profile.rateKgWeek : 0;
  const target = profileSet ? profile.targetWeightKg : undefined;
  const projection = last && target && trend !== null ? projectTarget(last.avg, target, trend, today) : null;

  const submit = async () => {
    const v = parseFloat(kg.replace(",", "."));
    if (!v || v < 20 || v > 400) return toast.error("Peso no válido");
    await saveWeight.mutateAsync({ date: wDate, kg: v });
    // El pesaje más reciente es el peso del perfil: los objetivos se recalculan con él.
    // Solo si el usuario ya tiene perfil propio: nunca se guarda el de ejemplo.
    if (profileSet && (!last || wDate >= last.date) && v !== profile.weightKg) await saveProfile.mutateAsync({ ...profile, weightKg: v });
    toast.success("Peso registrado");
    setOpen(false);
    setKg("");
  };

  return (
    <SystemWindow
      title="Peso corporal"
      action={
        <button className="btn-ghost min-h-9 px-3 text-xs" onClick={() => setOpen(true)}>
          <Scale className="h-4 w-4" /> Registrar
        </button>
      }
    >
      {series.length < 2 || !last ? (
        <p className="text-muted-foreground py-6 text-center text-xs">Registra al menos 2 pesos para ver la gráfica.</p>
      ) : (
        <>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-display neon-text text-3xl font-bold tabular-nums">{last.avg.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</span>
            <span className="text-muted-foreground text-xs">kg de media (7 días)</span>
            {change !== null && <span className="text-muted-foreground ml-auto text-xs tabular-nums">{signed(change, 1)} kg</span>}
          </div>
          <Seg value={period} options={PERIODS} onChange={setPeriod} />
          {data.length < 2 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">No hay 2 pesajes en este periodo.</p>
          ) : (
            <div className="mt-3 h-44">
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(x: number) => formatShortDate(addDaysISO(origin, x))}
                    tickCount={5}
                    {...axis}
                  />
                  <YAxis {...axis} domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false} />
                  <Tooltip
                    {...tip}
                    labelFormatter={(x) => formatShortDate(addDaysISO(origin, Number(x)))}
                    formatter={(v, name) => [`${v} kg`, name === "avg" ? "Media 7 días" : "Pesaje"]}
                  />
                  <Line dataKey="kg" stroke="var(--muted-foreground)" strokeWidth={1} strokeOpacity={0.3} dot={{ r: 2, strokeOpacity: 1 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="avg" stroke="var(--primary)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-muted-foreground mt-1 text-[11px]">Línea: media de 7 días · Puntos: cada pesaje</p>

          <div className="border-border mt-3 space-y-1 border-t pt-3 text-xs">
            {trend === null ? (
              <p className="text-muted-foreground">
                Para ver tu ritmo hacen falta {TREND_MIN_WEIGHINS} pesajes en las últimas 4 semanas, separados al menos una semana.
              </p>
            ) : (
              <>
                <p>
                  Ritmo actual: <span className="font-semibold tabular-nums">{signed(trend)} kg/semana</span>
                  {profileSet && <span className="text-muted-foreground"> · plan: {planRate === 0 ? "mantener" : `${signed(planRate)} kg/semana`}</span>}
                </p>
                {projection?.kind === "date" && (
                  <p>
                    A este ritmo llegas a {target} kg hacia el <span className="font-semibold">{formatShortDate(projection.date)}</span>
                    <span className="text-muted-foreground"> (unas {Math.max(1, Math.round(projection.weeks))} semanas)</span>
                  </p>
                )}
                {projection?.kind === "reached" && <p className="text-success">Estás en tu peso objetivo ({target} kg).</p>}
                {projection?.kind === "away" && <p className="text-muted-foreground">Con el ritmo actual aún no se puede estimar cuándo llegas a {target} kg.</p>}
              </>
            )}
          </div>
        </>
      )}

      {series.length > 0 && (
        <ul className="divide-border mt-3 max-h-40 divide-y overflow-y-auto text-sm">
          {[...series].reverse().slice(0, 10).map((w) => (
            <li key={w.date} className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground text-xs">{formatShortDate(w.date)}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {w.kg} kg
                <button aria-label={`Borrar el peso del ${formatShortDate(w.date)}`} className="text-muted-foreground p-2" onClick={() => removeWeight.mutate(w.date)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Sheet title="Registrar peso" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="label-sys" htmlFor="wdate">Fecha</label>
              <input id="wdate" type="date" className="field" value={wDate} max={today} onChange={(e) => setWDate(e.target.value)} />
            </div>
            <div>
              <label className="label-sys" htmlFor="wkg">Peso (kg)</label>
              <input
                id="wkg"
                autoFocus
                inputMode="decimal"
                className="field font-display text-2xl tabular-nums"
                value={kg}
                placeholder={last ? String(last.kg) : "75.0"}
                onChange={(e) => setKg(e.target.value)}
              />
            </div>
            <button className="btn-primary w-full" onClick={submit}>Guardar</button>
          </div>
        </Sheet>
      )}
    </SystemWindow>
  );
}
