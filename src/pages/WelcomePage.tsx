import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { SystemWindow } from "@/components/SystemWindow";
import { Num, ScenarioCard, Seg } from "@/components/ProfileControls";
import type { Activity, Goal, Sex } from "@/lib/types";
import { ACTIVITY_LABELS } from "@/lib/nutrition";
import { GOAL_LABELS, scenarios, targetWarnings } from "@/lib/goals";
import { basicsError, EMPTY_BASICS, profileFromBasics, skipWelcome, type Basics } from "@/lib/welcome";
import { useProfileSet, useSaveProfile, useSaveWeight } from "@/lib/hooks";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

const ACTIVITY_HINTS: Record<Activity, string> = {
  sedentario: "Trabajo sentado y poco o ningún ejercicio",
  ligero: "Ejercicio suave 1-3 días por semana",
  moderado: "Entrenas 3-5 días por semana",
  alto: "Entrenas fuerte 6-7 días por semana",
  muy_alto: "Trabajo físico o dos sesiones al día",
};

const GOAL_HINTS: Record<Goal, string> = {
  perder: "Comes algo menos de lo que gastas para perder grasa conservando músculo.",
  mantener: "Comes lo que gastas. Buen punto de partida si no lo tienes claro.",
  ganar: "Comes algo más de lo que gastas para ganar músculo poco a poco.",
};

const STEPS = ["Tus datos", "Tu objetivo", "Tu plan"];

export function WelcomePage() {
  const navigate = useNavigate();
  const profileSet = useProfileSet();
  const save = useSaveProfile();
  const saveWeight = useSaveWeight();
  const [step, setStep] = useState(0);
  const [b, setB] = useState<Basics>(EMPTY_BASICS);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [showError, setShowError] = useState(false);
  const set = <K extends keyof Basics>(k: K, v: Basics[K]) => setB((x) => ({ ...x, [k]: v }));

  // Quien ya tiene perfil lo cambia en Perfil; `saving` evita el salto mientras se guarda aquí.
  if (profileSet && !save.isPending && !save.isSuccess) return <Navigate to="/perfil" replace />;

  const error = basicsError(b);
  const preview = profileFromBasics(b, goal ?? "mantener");
  const plans = preview ? scenarios(preview).map((s) => ({ ...s, active: s.goal === goal })) : [];
  const chosen = plans.find((s) => s.active);
  const warnings = preview && goal ? targetWarnings(preview) : [];

  const next = () => {
    if (step === 0 && error) return setShowError(true);
    setStep((s) => s + 1);
  };

  const finish = async () => {
    if (!preview || !goal) return;
    await save.mutateAsync(preview);
    await saveWeight.mutateAsync({ date: todayISO(), kg: preview.weightKg });
    toast.success("Objetivo configurado");
    navigate("/", { replace: true });
  };

  return (
    <div className="space-y-4">
      <header className="px-1">
        <p className="label-sys">
          Paso {step + 1} de {STEPS.length}
        </p>
        <h1 className="font-display text-2xl font-bold">{step === 0 ? "Bienvenido a Macro Quest" : STEPS[step]}</h1>
        <p className="text-muted-foreground text-xs">
          {step === 0 && "Con estos datos se calcula cuánto gastas al día. Se guardan solo en tu dispositivo."}
          {step === 1 && "Elige qué quieres conseguir. Son calorías al día; podrás cambiarlo cuando quieras."}
          {step === 2 && "Este es tu objetivo diario. El diario te dirá cuánto te queda en cada momento."}
        </p>
      </header>

      {step === 0 && (
        <SystemWindow title={STEPS[0]!}>
          <div className="space-y-4">
            <div>
              <span className="label-sys">Sexo</span>
              <Seg<Sex> value={b.sex ?? ("" as Sex)} onChange={(v) => set("sex", v)} options={[["hombre", "Hombre"], ["mujer", "Mujer"]]} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Num label="Edad" value={b.age} onChange={(n) => set("age", n)} suffix="años" />
              <Num label="Altura" value={b.heightCm} onChange={(n) => set("heightCm", n)} suffix="cm" />
              <Num label="Peso" value={b.weightKg} onChange={(n) => set("weightKg", n)} suffix="kg" />
            </div>
            <div>
              <span className="label-sys">Actividad</span>
              <div className="space-y-2">
                {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={b.activity === a}
                    onClick={() => set("activity", a)}
                    className={cn("block min-h-12 w-full border px-3 py-1.5 text-left", b.activity === a ? "border-primary bg-primary/15" : "border-border")}
                  >
                    <span className={cn("block text-sm", b.activity === a && "text-primary")}>{ACTIVITY_LABELS[a].replace(/ \(.*\)$/, "")}</span>
                    <span className="text-muted-foreground block text-[11px]">{ACTIVITY_HINTS[a]}</span>
                  </button>
                ))}
              </div>
            </div>
            {showError && error && (
              <p className="text-over flex gap-2 text-xs" role="alert">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {error}
              </p>
            )}
          </div>
        </SystemWindow>
      )}

      {step === 1 && (
        <SystemWindow title={STEPS[1]!}>
          <div className="grid grid-cols-3 gap-2">
            {plans.map((s) => (
              <ScenarioCard key={s.goal} s={s} onSelect={() => setGoal(s.goal)} />
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-[10px]">kcal al día · gramos de proteína · carbohidratos · grasa</p>
          <p className="mt-3 min-h-10 text-sm">{goal ? GOAL_HINTS[goal] : "Toca una opción para ver qué supone."}</p>
        </SystemWindow>
      )}

      {step === 2 && chosen && (
        <SystemWindow title={GOAL_LABELS[chosen.goal]}>
          <p className="text-center">
            <span className="font-display neon-text text-5xl font-bold tabular-nums">{chosen.targets.kcal}</span>
            <span className="text-muted-foreground ml-2 text-sm">kcal al día</span>
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-display text-protein text-xl font-bold tabular-nums">{chosen.targets.protein} g</p>
              <p className="label-sys">proteína</p>
            </div>
            <div>
              <p className="font-display text-carbs text-xl font-bold tabular-nums">{chosen.targets.carbs} g</p>
              <p className="label-sys">carbohidratos</p>
            </div>
            <div>
              <p className="font-display text-fat text-xl font-bold tabular-nums">{chosen.targets.fat} g</p>
              <p className="label-sys">grasa</p>
            </div>
          </div>
          <p className="text-muted-foreground mt-4 text-center text-[11px] tabular-nums">
            En reposo gastas {chosen.targets.bmr} kcal · con tu actividad, {chosen.targets.tdee} kcal
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
          <p className="text-muted-foreground mt-4 text-[11px]">
            Es una estimación. En Perfil puedes afinarla más adelante: ritmo, peso objetivo, medidas de cuello y cintura para el % de grasa, y calorías
            distintas según el día. Cuando lleves dos semanas registrando comida y peso, la app calculará tu gasto real.
          </p>
        </SystemWindow>
      )}

      <div className="grid grid-cols-2 gap-2">
        {step === 0 ? (
          <button
            type="button"
            className="btn-ghost min-h-12"
            onClick={() => {
              skipWelcome();
              navigate("/", { replace: true });
            }}
          >
            Ahora no
          </button>
        ) : (
          <button type="button" className="btn-ghost min-h-12" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" /> Atrás
          </button>
        )}
        {step < 2 ? (
          <button type="button" className="btn-primary min-h-12" onClick={next} disabled={step === 1 && !goal}>
            Siguiente <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" className="btn-primary min-h-12" onClick={finish} disabled={save.isPending}>
            Empezar
          </button>
        )}
      </div>
    </div>
  );
}
