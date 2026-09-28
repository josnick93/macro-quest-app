import { useState } from "react";
import { Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, ReferenceLine } from "recharts";
import { SystemWindow } from "@/components/SystemWindow";
import { Sheet } from "@/components/Sheet";
import { XPBar } from "@/components/XPBar";
import { addDaysISO, formatShortDate, todayISO } from "@/lib/date";
import { totalsFor } from "@/lib/nutrition";
import { useDiaryRange, useGame, useRemoveWeight, useSaveWeight, useTargets, useWeights } from "@/lib/hooks";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = {
  contentStyle: { background: "oklch(0.16 0.03 256)", border: "1px solid var(--primary)", fontSize: 12 },
  labelStyle: { color: "var(--muted-foreground)" },
};

export function ProgressPage() {
  const today = todayISO();
  const from = addDaysISO(today, -6);
  const { data: weights } = useWeights();
  const { data: week } = useDiaryRange(from, today);
  const { data: game } = useGame();
  const targets = useTargets();
  const saveWeight = useSaveWeight();
  const removeWeight = useRemoveWeight();
  const [open, setOpen] = useState(false);
  const [wDate, setWDate] = useState(today);
  const [kg, setKg] = useState("");

  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(from, i));
  const daily = days.map((d) => {
    const t = totalsFor(week.filter((e) => e.date === d));
    return { d: formatShortDate(d), kcal: Math.round(t.kcal), protein: Math.round(t.protein), logged: t.kcal > 0 };
  });
  const logged = daily.filter((x) => x.logged);
  const avg = (k: "kcal" | "protein") => (logged.length ? Math.round(logged.reduce((a, x) => a + x[k], 0) / logged.length) : 0);

  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const wData = sorted.slice(-60).map((w) => ({ d: formatShortDate(w.date), kg: w.kg }));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const diff = first && last ? Math.round((last.kg - first.kg) * 10) / 10 : 0;

  const submit = async () => {
    const v = parseFloat(kg.replace(",", "."));
    if (!v || v < 20 || v > 400) return toast.error("Peso no válido");
    await saveWeight.mutateAsync({ date: wDate, kg: v });
    toast.success("Peso registrado");
    setOpen(false);
    setKg("");
  };

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-2xl font-bold">Progreso</h1>
        <p className="text-muted-foreground text-xs">Estadísticas del jugador</p>
      </header>

      <XPBar xp={game.xp} streak={game.streak} />

      <SystemWindow
        title="Peso corporal"
        action={
          <button className="btn-ghost min-h-9 px-3 text-xs" onClick={() => setOpen(true)}>
            <Scale className="h-4 w-4" /> Registrar
          </button>
        }
      >
        {wData.length < 2 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">Registra al menos 2 pesos para ver la gráfica.</p>
        ) : (
          <>
            <div className="mb-2 flex items-baseline gap-3">
              <span className="font-display neon-text text-3xl font-bold tabular-nums">{last?.kg}</span>
              <span className="text-muted-foreground text-xs">kg</span>
              <span className={`text-xs tabular-nums ${diff <= 0 ? "text-success" : "text-fat"}`}>
                {diff > 0 ? "+" : ""}
                {diff} kg desde {first && formatShortDate(first.date)}
              </span>
            </div>
            <div className="h-44">
              <ResponsiveContainer>
                <LineChart data={wData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="oklch(0.3 0.04 256 / 0.4)" vertical={false} />
                  <XAxis dataKey="d" {...axis} minTickGap={20} />
                  <YAxis {...axis} domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false} />
                  <Tooltip {...tip} formatter={(v) => [`${v} kg`, "Peso"]} />
                  <Line type="monotone" dataKey="kg" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
        {sorted.length > 0 && (
          <ul className="divide-border mt-3 max-h-40 divide-y overflow-y-auto text-sm">
            {[...sorted].reverse().slice(0, 10).map((w) => (
              <li key={w.date} className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground text-xs">{formatShortDate(w.date)}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  {w.kg} kg
                  <button aria-label="Borrar" className="text-muted-foreground p-1" onClick={() => removeWeight.mutate(w.date)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SystemWindow>

      <SystemWindow title="Últimos 7 días">
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-display text-xl font-bold tabular-nums">{avg("kcal")}</p>
            <p className="label-sys">kcal/día</p>
          </div>
          <div>
            <p className="font-display text-protein text-xl font-bold tabular-nums">{avg("protein")}</p>
            <p className="label-sys">prot g/día</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold tabular-nums">{logged.length}/7</p>
            <p className="label-sys">días</p>
          </div>
        </div>
        <div className="h-40">
          <ResponsiveContainer>
            <BarChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="oklch(0.3 0.04 256 / 0.4)" vertical={false} />
              <XAxis dataKey="d" {...axis} />
              <YAxis {...axis} domain={[0, (max: number) => Math.max(max, targets.kcal) * 1.1]} tickFormatter={(v: number) => String(Math.round(v))} />
              <Tooltip {...tip} cursor={{ fill: "oklch(0.3 0.04 256 / 0.3)" }} formatter={(v) => [`${v} kcal`, "Energía"]} />
              <ReferenceLine y={targets.kcal} stroke="var(--fat)" strokeDasharray="4 4" />
              <Bar dataKey="kcal" fill="var(--primary)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-muted-foreground mt-1 text-[11px]">Línea discontinua: objetivo {targets.kcal} kcal</p>
      </SystemWindow>

      <SystemWindow title="Registro de nivel">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-display text-xl font-bold tabular-nums">{Math.round(game.xp)}</p>
            <p className="label-sys">XP total</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold tabular-nums">{game.streak}</p>
            <p className="label-sys">racha</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold tabular-nums">{game.history.length}</p>
            <p className="label-sys">días activos</p>
          </div>
        </div>
      </SystemWindow>

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
    </div>
  );
}
