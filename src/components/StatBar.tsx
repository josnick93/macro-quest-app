interface Props {
  label: string;
  value: number;
  target: number;
  unit?: string;
  color: "protein" | "carbs" | "fat" | "primary";
}

const COLORS: Record<Props["color"], string> = {
  protein: "var(--protein)",
  carbs: "var(--carbs)",
  fat: "var(--fat)",
  primary: "var(--primary)",
};

export function StatBar({ label, value, target, unit = "g", color }: Props) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const tint = COLORS[color];
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-display tracking-[0.14em] uppercase" style={{ color: tint }}>
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          <span className="text-foreground font-medium">{Math.round(value)}</span> / {Math.round(target)} {unit}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[oklch(0.25_0.04_256)]"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bar-glow h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: tint, color: tint }}
        />
      </div>
    </div>
  );
}
