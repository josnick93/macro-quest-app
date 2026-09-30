import type { Macros } from "@/lib/types";
import { kcalFromMacros } from "@/lib/diary";

export type MacroStrings = Record<keyof Macros, string>;

export const macroStrings = (m?: Macros): MacroStrings => ({
  kcal: m ? String(Math.round(m.kcal)) : "",
  protein: m ? String(m.protein) : "",
  carbs: m ? String(m.carbs) : "",
  fat: m ? String(m.fat) : "",
});

const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

/** Macros introducidos; si kcal está vacío se calculan a partir de P/C/G. */
export function parseMacroStrings(v: MacroStrings): Macros {
  const protein = num(v.protein);
  const carbs = num(v.carbs);
  const fat = num(v.fat);
  const kcal = num(v.kcal) || kcalFromMacros({ protein, carbs, fat });
  return { kcal, protein, carbs, fat };
}

const FIELDS: [keyof Macros, string][] = [
  ["protein", "Proteína (g)"],
  ["carbs", "Carbos (g)"],
  ["fat", "Grasa (g)"],
];

export function MacroFields({ value, onChange, autoFocus }: { value: MacroStrings; onChange: (v: MacroStrings) => void; autoFocus?: boolean }) {
  const clean = (s: string) => s.replace(",", ".").replace(/[^\d.]/g, "");
  const computed = Math.round(kcalFromMacros({ protein: num(value.protein), carbs: num(value.carbs), fat: num(value.fat) }));
  return (
    <div className="space-y-3">
      <div>
        <label className="label-sys" htmlFor="mf-kcal">Kcal</label>
        <input
          id="mf-kcal"
          className="field font-display text-2xl tabular-nums"
          inputMode="decimal"
          autoFocus={autoFocus}
          placeholder={computed > 0 ? `${computed} (según macros)` : "0"}
          value={value.kcal}
          onChange={(e) => onChange({ ...value, kcal: clean(e.target.value) })}
          onFocus={(e) => e.target.select()}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map(([k, l]) => (
          <div key={k}>
            <label className="label-sys" htmlFor={`mf-${k}`}>{l}</label>
            <input
              id={`mf-${k}`}
              className="field tabular-nums"
              inputMode="decimal"
              placeholder="opcional"
              value={value[k]}
              onChange={(e) => onChange({ ...value, [k]: clean(e.target.value) })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
