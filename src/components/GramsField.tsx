const QUICK = [50, 100, 150, 200, 250];

export function GramsField({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div>
      <label className="label-sys" htmlFor="grams">
        Gramos
      </label>
      <input
        id="grams"
        className="field font-display text-2xl tabular-nums"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
        onFocus={(e) => e.target.select()}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK.map((g) => (
          <button key={g} type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => onChange(String(g))}>
            {g} g
          </button>
        ))}
      </div>
    </div>
  );
}
