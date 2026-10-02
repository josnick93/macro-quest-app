import { useState } from "react";
import type { Serving } from "@/lib/types";
import { quantityGrams, sameUnit, type Quantity } from "@/lib/foods";
import { cn } from "@/lib/utils";

const QUICK_GRAMS = [50, 100, 150, 200, 250];

/** Cantidad en gramos o en raciones/unidades del alimento ("2 × rebanada"). */
export function QuantityField({
  units,
  value,
  onChange,
  autoFocus,
}: {
  units: Serving[];
  value: Quantity;
  onChange: (q: Quantity) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(String(value.amount));
  const isGrams = value.unit.label === "g";

  const setAmount = (raw: string) => {
    const clean = raw.replace(",", ".").replace(/[^\d.]/g, "");
    setText(clean);
    onChange({ ...value, amount: parseFloat(clean) || 0 });
  };
  const setUnit = (unit: Serving) => {
    // Al cambiar a una ración, empezar en 1; al volver a gramos, conservar el peso.
    const amount = unit.label === "g" ? quantityGrams(value) : 1;
    setText(String(amount));
    onChange({ unit, amount });
  };

  return (
    <div>
      <label className="label-sys" htmlFor="qty">
        Cantidad {!isGrams && value.amount > 0 && <span className="normal-case tracking-normal">· {Math.round(quantityGrams(value))} g</span>}
      </label>
      <input
        id="qty"
        className="field font-display text-2xl tabular-nums"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setAmount(e.target.value)}
        onFocus={(e) => e.target.select()}
      />
      {units.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Unidad">
          {units.map((u) => (
            <button
              key={`${u.label}-${u.grams}`}
              type="button"
              aria-pressed={sameUnit(value.unit, u)}
              onClick={() => setUnit(u)}
              className={cn(
                "min-h-11 border px-3 text-xs",
                sameUnit(value.unit, u) ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {u.label === "g" ? "gramos" : `${u.label} · ${Math.round(u.grams)} g`}
            </button>
          ))}
        </div>
      )}
      {isGrams && (
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_GRAMS.map((g) => (
            <button key={g} type="button" className="btn-ghost min-h-11 px-3 text-xs" onClick={() => setAmount(String(g))}>
              {g} g
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
