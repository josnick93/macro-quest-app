import type { Activity, Goal, Profile, Sex } from "./types";
import { defaultRate } from "./goals";
import { DEFAULT_PROFILE } from "./repos/migrations";

/** Datos mínimos que pide la bienvenida. Vacío = aún sin rellenar. */
export interface Basics {
  sex: Sex | null;
  age: number | undefined;
  heightCm: number | undefined;
  weightKg: number | undefined;
  activity: Activity | null;
}

export const EMPTY_BASICS: Basics = { sex: null, age: undefined, heightCm: undefined, weightKg: undefined, activity: null };

const RANGES = {
  age: { min: 14, max: 100, label: "La edad" },
  heightCm: { min: 120, max: 230, label: "La altura" },
  weightKg: { min: 30, max: 300, label: "El peso" },
} as const;

/** Primer problema de los datos, o null si están completos y son creíbles. */
export function basicsError(b: Basics): string | null {
  if (!b.sex) return "Elige el sexo (se usa para calcular tu metabolismo).";
  for (const key of ["age", "heightCm", "weightKg"] as const) {
    const v = b[key];
    const r = RANGES[key];
    if (v === undefined) return `${r.label} está sin rellenar.`;
    if (v < r.min || v > r.max) return `${r.label} debe estar entre ${r.min} y ${r.max}.`;
  }
  if (!b.activity) return "Elige tu nivel de actividad.";
  return null;
}

/** Perfil inicial: los datos de la bienvenida, el ritmo recomendado y el reparto de macros por defecto. */
export function profileFromBasics(b: Basics, goal: Goal): Profile | null {
  if (basicsError(b)) return null;
  return {
    sex: b.sex!,
    age: b.age!,
    heightCm: b.heightCm!,
    weightKg: b.weightKg!,
    activity: b.activity!,
    goal,
    rateKgWeek: defaultRate(goal === "mantener" ? "perder" : goal, b.weightKg!),
    proteinPerKg: DEFAULT_PROFILE.proteinPerKg,
    fatPct: DEFAULT_PROFILE.fatPct,
  };
}

const SKIP_KEY = "mq:skipWelcome";

/** «Ahora no» vale solo para esta sesión: la próxima vez se vuelve a ofrecer. */
export const welcomeSkipped = (): boolean => {
  try {
    return sessionStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
};
export const skipWelcome = () => {
  try {
    sessionStorage.setItem(SKIP_KEY, "1");
  } catch {
    /* sin almacenamiento: se volverá a ofrecer */
  }
};
