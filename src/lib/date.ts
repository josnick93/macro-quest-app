export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const todayISO = (): string => toISODate(new Date());

function parseISO(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export const formatLongDate = (iso: string) =>
  parseISO(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

export const formatShortDate = (iso: string) =>
  parseISO(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });

export function msUntilMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** "Hoy", "Ayer", "Mañana" o la fecha larga. */
export function relativeDayLabel(iso: string, today: string): string {
  if (iso === today) return "Hoy";
  if (iso === addDaysISO(today, -1)) return "Ayer";
  if (iso === addDaysISO(today, 1)) return "Mañana";
  return formatLongDate(iso);
}

export const isISODate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
