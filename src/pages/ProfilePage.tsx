import { useEffect, useState } from "react";
import { Download, Minus, Plus, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { SystemWindow } from "@/components/SystemWindow";
import { AccountWindow } from "@/components/AccountWindow";
import { fmt, Num, ScenarioCard, Seg, signed } from "@/components/ProfileControls";
import { MEALS, type Activity, type Profile, type Sex } from "@/lib/types";
import { ACTIVITY_LABELS, calcTargets, formulaTDEE, goalDeltaKcal, leanMassKg, navyBodyFat } from "@/lib/nutrition";
import { scenarios, targetWarnings, TDEE_MIN_DAYS, TDEE_MIN_WEIGHINS, TDEE_WINDOW_DAYS, weeksToTarget } from "@/lib/goals";
import { useAccount, useProfile, useSaveProfile, useSaveSettings, useSaveWeight, useSettings, useTdeeEstimate } from "@/lib/hooks";
import { repos } from "@/lib/repos";
import { ImportError, parseImport, SCHEMA_VERSION, type ExportFile } from "@/lib/repos/migrations";
import { addDaysISO, todayISO } from "@/lib/date";
import { BACKUP_EVERY_DAYS, daysSince, lastBackup, markBackup } from "@/lib/backup";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const WEEKDAY_STEP = 50;
const WEEKDAY_LIMIT = 1500;

export function ProfilePage() {
  const { data } = useProfile();
  const account = useAccount();
  const save = useSaveProfile();
  const saveWeight = useSaveWeight();
  const { data: settings } = useSettings();
  const saveSettings = useSaveSettings();
  const estimate = useTdeeEstimate();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === "#datos") document.getElementById("datos")?.scrollIntoView();
  }, [hash]);
  const toggleMeal = (id: (typeof MEALS)[number]["id"]) => {
    const hidden = settings.hiddenMeals.includes(id) ? settings.hiddenMeals.filter((m) => m !== id) : [...settings.hiddenMeals, id];
    if (hidden.length === MEALS.length) return toast.error("Deja al menos una comida visible");
    saveSettings.mutate({ ...settings, hiddenMeals: hidden });
  };
  const [p, setP] = useState<Profile>(data);
  useEffect(() => setP(data), [data]);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  const req = <K extends "age" | "heightCm" | "weightKg" | "proteinPerKg" | "fatPct">(k: K) => (n: number | undefined) => {
    if (n !== undefined) set(k, n);
  };
  const dirty = JSON.stringify(p) !== JSON.stringify(data);

  const t = calcTargets(p);
  const warnings = targetWarnings(p);
  const lean = leanMassKg(p);
  const navy = navyBodyFat(p);
  const delta = Math.round(goalDeltaKcal(p));
  const weeks = weeksToTarget(p);
  const formula = Math.round(formulaTDEE(p));
  const week = p.weekdayKcal ?? [0, 0, 0, 0, 0, 0, 0];
  const weekAvg = Math.round(t.kcal + week.reduce((a, x) => a + x, 0) / 7);

  const bumpWeekday = (i: number, by: number) => {
    const next = week.map((x, j) => (j === i ? Math.max(-WEEKDAY_LIMIT, Math.min(WEEKDAY_LIMIT, x + by)) : x));
    set("weekdayKcal", next.some((x) => x !== 0) ? next : undefined);
  };

  const submit = async () => {
    await save.mutateAsync(p);
    if (p.weightKg !== data.weightKg) await saveWeight.mutateAsync({ date: todayISO(), kg: p.weightKg });
    toast.success("Perfil actualizado");
  };

  const [backupDays, setBackupDays] = useState(() => daysSince(lastBackup(), Date.now()));

  const exportData = async () => {
    try {
      const file: ExportFile = { app: "macro-quest", schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: await repos.data.exportAll() };
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `macro-quest-${todayISO()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      markBackup();
      setBackupDays(0);
    } catch (e) {
      toast.error(`No se pudo exportar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const importData = async (file: File) => {
    try {
      const snapshot = parseImport(JSON.parse(await file.text()));
      const summary = `${snapshot.diary.length} entradas, ${snapshot.foods.length} alimentos propios, ${snapshot.recipes.length} recetas y ${snapshot.weights.length} pesos`;
      const where = account ? "de tu cuenta, en todos tus dispositivos," : "de este dispositivo";
      if (!confirm(`Se sustituirán TODOS los datos ${where} por los del archivo (${summary}). ¿Continuar?`)) return;
      await repos.data.replaceAll(snapshot);
      toast.success("Datos importados");
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast.error(e instanceof ImportError ? e.message : e instanceof SyntaxError ? "El archivo no es JSON válido" : `No se pudo importar: ${String(e)}`);
    }
  };

  return (
    <div className={cn("space-y-4", dirty && "pb-16")}>
      <header className="px-1">
        <h1 className="font-display text-2xl font-bold">Perfil</h1>
        <p className="text-muted-foreground text-xs">Tus medidas y tu plan: definición, mantenimiento o volumen</p>
      </header>

      <SystemWindow title="Objetivo diario">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="font-display neon-text text-xl font-bold tabular-nums">{t.kcal}</p>
            <p className="label-sys">kcal</p>
          </div>
          <div>
            <p className="font-display text-protein text-xl font-bold tabular-nums">{t.protein}</p>
            <p className="label-sys">prot</p>
          </div>
          <div>
            <p className="font-display text-carbs text-xl font-bold tabular-nums">{t.carbs}</p>
            <p className="label-sys">carbs</p>
          </div>
          <div>
            <p className="font-display text-fat text-xl font-bold tabular-nums">{t.fat}</p>
            <p className="label-sys">grasa</p>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-center text-[11px] tabular-nums">
          Basal {t.bmr} kcal ({lean !== null ? "masa magra" : "Mifflin-St Jeor"}) · Gasto {t.tdee} kcal{p.tdeeOverride ? " (medido)" : ""}
        </p>
        {warnings.length > 0 && (
          <ul className="text-over mt-3 space-y-1 text-[11px]">
            {warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {w}
              </li>
            ))}
          </ul>
        )}
      </SystemWindow>

      <SystemWindow title="Plan" scan={false}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {scenarios(p).map((s) => (
              <ScenarioCard key={s.goal} s={s} onSelect={() => setP((x) => ({ ...x, goal: s.goal, rateKgWeek: s.goal === "mantener" ? x.rateKgWeek : s.rateKgWeek }))} />
            ))}
          </div>
          <p className="text-muted-foreground -mt-2 text-[10px]">kcal al día · gramos de proteína · carbohidratos · grasa</p>
          {p.goal !== "mantener" && (
            <div>
              <label className="label-sys" htmlFor="rate">
                Ritmo: {fmt(p.rateKgWeek)} kg/semana · {signed(delta, 0)} kcal/día
              </label>
              <input
                id="rate"
                type="range"
                min={0.05}
                max={p.goal === "perder" ? 1 : 0.5}
                step={0.05}
                value={p.rateKgWeek}
                onChange={(e) => set("rateKgWeek", +e.target.value)}
                className="accent-primary min-h-11 w-full"
              />
              <p className="text-muted-foreground text-[11px] tabular-nums">
                {fmt((p.rateKgWeek / p.weightKg) * 100)} % de tu peso por semana
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 items-end gap-2">
            <Num label="Peso objetivo" value={p.targetWeightKg} onChange={(n) => set("targetWeightKg", n && n > 0 ? n : undefined)} suffix="kg" placeholder="opcional" />
            <p className="text-muted-foreground pb-2 text-[11px] tabular-nums">
              {weeks !== null
                ? `≈ ${Math.ceil(weeks)} semanas · ${new Date(`${addDaysISO(todayISO(), Math.ceil(weeks * 7))}T12:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`
                : p.targetWeightKg && p.goal === "mantener"
                  ? "Elige definición o volumen para ver el plazo."
                  : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Num label="Proteína" value={p.proteinPerKg} onChange={req("proteinPerKg")} suffix="g/kg" />
            <Num label="Grasa" value={p.fatPct} onChange={req("fatPct")} suffix="% kcal" />
          </div>
          {lean !== null && (
            <p className="text-muted-foreground -mt-2 text-[11px] tabular-nums">
              {t.protein} g de proteína = {fmt(t.protein / lean, 1)} g por kg de masa magra ({fmt(lean, 1)} kg)
            </p>
          )}
        </div>
      </SystemWindow>

      <SystemWindow title="Medidas" scan={false}>
        <div className="space-y-4">
          <div>
            <span className="label-sys">Sexo</span>
            <Seg<Sex> value={p.sex} onChange={(v) => set("sex", v)} options={[["hombre", "Hombre"], ["mujer", "Mujer"]]} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Num label="Edad" value={p.age} onChange={req("age")} />
            <Num label="Altura" value={p.heightCm} onChange={req("heightCm")} suffix="cm" />
            <Num label="Peso" value={p.weightKg} onChange={req("weightKg")} suffix="kg" />
          </div>
          <div>
            <label className="label-sys" htmlFor="act">Actividad</label>
            <select id="act" className="field" value={p.activity} onChange={(e) => set("activity", e.target.value as Activity)}>
              {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
                <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>
              ))}
            </select>
          </div>
          <div className={cn("grid gap-2", p.sex === "mujer" ? "grid-cols-3" : "grid-cols-2")}>
            <Num label="Cuello" value={p.neckCm} onChange={(n) => set("neckCm", n)} suffix="cm" />
            <Num label="Cintura" value={p.waistCm} onChange={(n) => set("waistCm", n)} suffix="cm" />
            {p.sex === "mujer" && <Num label="Cadera" value={p.hipCm} onChange={(n) => set("hipCm", n)} suffix="cm" />}
          </div>
          <div className="grid grid-cols-2 items-end gap-2">
            <Num label="Grasa corporal" value={p.bodyFatPct} onChange={(n) => set("bodyFatPct", n && n > 0 ? n : undefined)} suffix="%" placeholder="opcional" />
            {navy !== null && navy !== p.bodyFatPct ? (
              <button type="button" className="btn-ghost min-h-11 text-xs" onClick={() => set("bodyFatPct", navy)}>
                Usar {fmt(navy, 1)} % (medidas)
              </button>
            ) : (
              <p className="text-muted-foreground pb-2 text-[11px]">
                {navy !== null ? "Calculado con tus medidas." : "Con cuello y cintura se estima solo."}
              </p>
            )}
          </div>
          <p className="text-muted-foreground text-[11px]">
            Cintura a la altura del ombligo{p.sex === "mujer" ? ", cadera en la parte más ancha" : ""}. Con el % de grasa, el basal se calcula sobre tu masa magra.
          </p>
        </div>
      </SystemWindow>

      <SystemWindow title="Gasto real" scan={false}>
        {estimate.tdee !== null ? (
          <p className="text-sm tabular-nums">
            En los últimos {TDEE_WINDOW_DAYS} días comes <strong>{estimate.avgKcal} kcal</strong> de media y tu peso cambia{" "}
            <strong>{signed(estimate.kgPerWeek)} kg/semana</strong>: gastas unas <strong className="text-primary">{estimate.tdee} kcal</strong> al día.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm tabular-nums">
            Con {TDEE_MIN_DAYS} días de diario y {TDEE_MIN_WEIGHINS} pesajes repartidos en dos semanas se calcula tu gasto real. Llevas {estimate.days}{" "}
            {estimate.days === 1 ? "día" : "días"} y {estimate.weighIns} {estimate.weighIns === 1 ? "pesaje" : "pesajes"} en los últimos {TDEE_WINDOW_DAYS} días.
          </p>
        )}
        <p className="text-muted-foreground mt-2 text-[11px] tabular-nums">
          {p.tdeeOverride ? `Usando gasto medido: ${p.tdeeOverride} kcal · la fórmula da ${formula} kcal.` : `Usando la fórmula: ${formula} kcal.`}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {estimate.tdee !== null && estimate.tdee !== p.tdeeOverride && (
            <button type="button" className="btn-ghost min-h-11 text-xs" onClick={() => set("tdeeOverride", estimate.tdee ?? undefined)}>
              Usar {estimate.tdee} kcal
            </button>
          )}
          {p.tdeeOverride && (
            <button type="button" className="btn-ghost min-h-11 text-xs" onClick={() => set("tdeeOverride", undefined)}>
              Volver a la fórmula
            </button>
          )}
        </div>
      </SystemWindow>

      <SystemWindow title="Por día de la semana" scan={false}>
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm">
            {p.weekdayKcal ? `Media semanal: ${weekAvg} kcal/día` : "Mismas calorías todos los días"}
          </summary>
          <ul className="divide-border/40 divide-y">
            {WEEKDAYS.map((d, i) => (
              <li key={d} className="flex items-center gap-2 py-1">
                <span className="min-w-0 flex-1 text-sm">
                  {d}
                  <span className="text-muted-foreground block text-[11px] tabular-nums">
                    {t.kcal + week[i]!} kcal{week[i] ? ` (${signed(week[i]!, 0)})` : ""}
                  </span>
                </span>
                <button type="button" aria-label={`Menos calorías el ${d.toLowerCase()}`} className="border-border flex h-11 w-11 items-center justify-center border" onClick={() => bumpWeekday(i, -WEEKDAY_STEP)}>
                  <Minus className="h-4 w-4" />
                </button>
                <button type="button" aria-label={`Más calorías el ${d.toLowerCase()}`} className="border-border flex h-11 w-11 items-center justify-center border" onClick={() => bumpWeekday(i, WEEKDAY_STEP)}>
                  <Plus className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-[11px]">Las calorías extra de un día van a carbohidratos y grasa; la proteína no cambia.</p>
        </details>
      </SystemWindow>

      <SystemWindow title="Comidas visibles" scan={false}>
        <div className="grid grid-cols-3 gap-2">
          {MEALS.map((m) => {
            const on = !settings.hiddenMeals.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleMeal(m.id)}
                className={cn("min-h-11 border text-xs", on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground line-through")}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-3 text-[11px]">Las ocultas siguen apareciendo en el diario si tienen algo registrado.</p>
      </SystemWindow>

      <AccountWindow />

      <SystemWindow title="Datos" scan={false}>
        <span id="datos" className="block scroll-mt-4" />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={exportData}>
            <Download className="h-4 w-4" /> Exportar
          </button>
          <label className="btn-ghost cursor-pointer">
            <Upload className="h-4 w-4" /> Importar
            <input type="file" accept="application/json" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) importData(f);
            }} />
          </label>
        </div>
        <p className="text-muted-foreground mt-3 text-[11px]">
          {account
            ? "Tus datos se guardan en la nube con tu cuenta. Puedes exportar además una copia propia."
            : "Tus datos se guardan solo en este dispositivo. Exporta de vez en cuando como copia de seguridad."}{" "}
          <span className={backupDays === null || backupDays >= BACKUP_EVERY_DAYS ? "text-over" : ""}>
            {backupDays === null ? "Aún no has exportado ninguna copia." : backupDays === 0 ? "Última copia: hoy." : `Última copia: hace ${backupDays} ${backupDays === 1 ? "día" : "días"}.`}
          </span>
        </p>
        <p className="text-muted-foreground mt-2 text-[11px]">
          Datos nutricionales de{" "}
          <a className="text-primary underline" href="https://openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>{" "}
          (licencia ODbL).
        </p>
      </SystemWindow>

      {dirty && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg px-4 pb-2">
          <div className="system-window flex items-center gap-2 px-4 py-2">
            <span className="min-w-0 flex-1 text-sm">Cambios sin guardar</span>
            <button type="button" className="btn-ghost min-h-11 px-3 text-sm" onClick={() => setP(data)}>
              Descartar
            </button>
            <button type="button" className="btn-primary min-h-11 px-4 text-sm" onClick={submit} disabled={save.isPending}>
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
