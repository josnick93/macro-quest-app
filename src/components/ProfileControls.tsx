import { useEffect, useState } from "react";
import { GOAL_LABELS, type Scenario } from "@/lib/goals";
import { cn } from "@/lib/utils";

/** Controles compartidos por Perfil y la bienvenida. */

export const fmt = (n: number, digits = 2) => n.toLocaleString("es-ES", { maximumFractionDigits: digits });
export const signed = (n: number, digits = 2) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n), digits)}`;

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
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

const parseNum = (s: string) => {
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
};

/** Campo numérico; vacío = undefined (los campos obligatorios ignoran ese valor). */
export function Num({
  label,
  value,
  onChange,
  suffix,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  suffix?: string;
  placeholder?: string;
}) {
  const [s, setS] = useState(value === undefined ? "" : String(value));
  // Solo se resincroniza si el valor cambia desde fuera (no mientras se escribe "80,").
  useEffect(() => {
    if (parseNum(s) !== value) setS(value === undefined ? "" : String(value));
  }, [value]);
  return (
    <label className="block">
      <span className="label-sys">{label}</span>
      <span className="relative block">
        <input
          className="field tabular-nums"
          inputMode="decimal"
          placeholder={placeholder}
          value={s}
          onChange={(e) => {
            const v = e.target.value.replace(",", ".");
            setS(v);
            onChange(parseNum(v));
          }}
        />
        {suffix && <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">{suffix}</span>}
      </span>
    </label>
  );
}

export function ScenarioCard({ s, onSelect }: { s: Scenario; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={s.active}
      onClick={onSelect}
      className={cn("min-h-24 border px-1 py-2 text-center", s.active ? "border-primary bg-primary/15" : "border-border")}
    >
      <span className={cn("block text-[11px]", s.active ? "text-primary" : "text-muted-foreground")}>{GOAL_LABELS[s.goal]}</span>
      <span className="font-display block text-xl font-bold tabular-nums">{s.targets.kcal}</span>
      <span className="text-muted-foreground block text-[10px] tabular-nums">
        {s.goal === "mantener" ? "peso estable" : `${signed(s.goal === "perder" ? -s.rateKgWeek : s.rateKgWeek)} kg/sem`}
      </span>
      <span className="block text-[10px] tabular-nums">
        <span className="text-protein">{s.targets.protein}</span> · <span className="text-carbs">{s.targets.carbs}</span> ·{" "}
        <span className="text-fat">{s.targets.fat}</span>
      </span>
    </button>
  );
}
