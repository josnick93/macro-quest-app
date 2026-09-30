import { useEffect, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { SystemWindow } from "@/components/SystemWindow";
import { MEALS, type Activity, type Goal, type Profile, type Sex } from "@/lib/types";
import { ACTIVITY_LABELS, calcTargets } from "@/lib/nutrition";
import { useProfile, useSaveProfile, useSaveSettings, useSaveWeight, useSettings } from "@/lib/hooks";
import { repos } from "@/lib/repos";
import { ImportError, parseImport, SCHEMA_VERSION, type ExportFile } from "@/lib/repos/migrations";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn("min-h-10 border text-xs", value === v ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Num({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  const [s, setS] = useState(String(value));
  useEffect(() => setS(String(value)), [value]);
  return (
    <div>
      <span className="label-sys">{label}</span>
      <div className="relative">
        <input
          className="field tabular-nums"
          inputMode="decimal"
          step={step}
          value={s}
          onChange={(e) => {
            const v = e.target.value.replace(",", ".");
            setS(v);
            const n = parseFloat(v);
            if (!Number.isNaN(n)) onChange(n);
          }}
        />
        {suffix && <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">{suffix}</span>}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { data } = useProfile();
  const save = useSaveProfile();
  const saveWeight = useSaveWeight();
  const { data: settings } = useSettings();
  const saveSettings = useSaveSettings();
  const toggleMeal = (id: (typeof MEALS)[number]["id"]) => {
    const hidden = settings.hiddenMeals.includes(id) ? settings.hiddenMeals.filter((m) => m !== id) : [...settings.hiddenMeals, id];
    if (hidden.length === MEALS.length) return toast.error("Deja al menos una comida visible");
    saveSettings.mutate({ ...settings, hiddenMeals: hidden });
  };
  const [p, setP] = useState<Profile>(data);
  useEffect(() => setP(data), [data]);
  const t = calcTargets(p);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    await save.mutateAsync(p);
    if (p.weightKg !== data.weightKg) await saveWeight.mutateAsync({ date: todayISO(), kg: p.weightKg });
    toast.success("Perfil actualizado");
  };

  const exportData = async () => {
    try {
      const file: ExportFile = { app: "macro-quest", schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: await repos.data.exportAll() };
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `macro-quest-${todayISO()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      toast.error(`No se pudo exportar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const importData = async (file: File) => {
    try {
      const snapshot = parseImport(JSON.parse(await file.text()));
      const summary = `${snapshot.diary.length} entradas, ${snapshot.foods.length} alimentos propios, ${snapshot.recipes.length} recetas y ${snapshot.weights.length} pesos`;
      if (!confirm(`Se sustituirán TODOS los datos de este dispositivo por los del archivo (${summary}). ¿Continuar?`)) return;
      await repos.data.replaceAll(snapshot);
      toast.success("Datos importados");
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast.error(e instanceof ImportError ? e.message : e instanceof SyntaxError ? "El archivo no es JSON válido" : `No se pudo importar: ${String(e)}`);
    }
  };

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-2xl font-bold">Perfil</h1>
        <p className="text-muted-foreground text-xs">Parámetros del jugador y objetivos</p>
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
          Metabolismo basal {t.bmr} kcal · Gasto total {t.tdee} kcal
        </p>
      </SystemWindow>

      <SystemWindow title="Atributos" scan={false}>
        <div className="space-y-4">
          <div>
            <span className="label-sys">Sexo</span>
            <Seg<Sex> value={p.sex} onChange={(v) => set("sex", v)} options={[["hombre", "Hombre"], ["mujer", "Mujer"]]} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Num label="Edad" value={p.age} onChange={(n) => set("age", n)} />
            <Num label="Altura" value={p.heightCm} onChange={(n) => set("heightCm", n)} suffix="cm" />
            <Num label="Peso" value={p.weightKg} onChange={(n) => set("weightKg", n)} step={0.1} suffix="kg" />
          </div>
          <div>
            <label className="label-sys" htmlFor="act">Actividad</label>
            <select id="act" className="field" value={p.activity} onChange={(e) => set("activity", e.target.value as Activity)}>
              {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
                <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label-sys">Objetivo</span>
            <Seg<Goal> value={p.goal} onChange={(v) => set("goal", v)} options={[["perder", "Perder"], ["mantener", "Mantener"], ["ganar", "Ganar"]]} />
          </div>
          {p.goal !== "mantener" && (
            <div>
              <span className="label-sys">
                {p.goal === "perder" ? "Déficit" : "Superávit"}: {p.adjustPct}%
              </span>
              <input type="range" min={0} max={30} step={1} value={p.adjustPct} onChange={(e) => set("adjustPct", +e.target.value)} className="accent-primary w-full" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Num label="Proteína" value={p.proteinPerKg} onChange={(n) => set("proteinPerKg", n)} step={0.1} suffix="g/kg" />
            <Num label="Grasa" value={p.fatPct} onChange={(n) => set("fatPct", n)} suffix="% kcal" />
          </div>
          <button className="btn-primary w-full" onClick={submit} disabled={save.isPending}>Guardar</button>
        </div>
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

      <SystemWindow title="Datos" scan={false}>
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
          Tus datos se guardan solo en este dispositivo. Exporta de vez en cuando como copia de seguridad.
        </p>
        <p className="text-muted-foreground mt-2 text-[11px]">
          Datos nutricionales de{" "}
          <a className="text-primary underline" href="https://openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>{" "}
          (licencia ODbL).
        </p>
      </SystemWindow>
    </div>
  );
}
