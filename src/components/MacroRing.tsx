export function MacroRing({ consumed, target }: { consumed: number; target: number }) {
  const size = 188;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;
  const remaining = Math.round(target - consumed);
  const over = remaining < 0;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(0.25 0.04 256)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--over)" : "var(--primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(0.2,0.8,0.2,1)",
            filter: `drop-shadow(0 0 8px ${over ? "oklch(0.8 0.14 70 / 55%)" : "oklch(0.72 0.16 250 / 65%)"})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-muted-foreground font-display text-[11px] tracking-[0.22em] uppercase">
          {over ? "Por encima" : "Restantes"}
        </span>
        <span className="font-display text-5xl leading-none font-bold tabular-nums">{Math.abs(remaining)}</span>
        <span className="text-muted-foreground mt-1 text-xs">
          kcal · {Math.round(consumed)} de {Math.round(target)}
        </span>
      </div>
    </div>
  );
}
