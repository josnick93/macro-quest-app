/** Recordatorio de copia de seguridad. Es por dispositivo: se guarda en localStorage, no en los datos. */

export const BACKUP_KEY = "mq:lastBackup";
const NAG_KEY = "mq:backupNag";

/** Días sin copia a partir de los cuales se recuerda. */
export const BACKUP_EVERY_DAYS = 14;
/** No se repite el aviso antes de estos días. */
export const NAG_EVERY_DAYS = 7;
/** Con menos días de diario no merece la pena avisar. */
export const MIN_ACTIVE_DAYS = 3;

const DAY = 86_400_000;

/** Días enteros desde una fecha ISO; null si no hay fecha válida. */
export function daysSince(iso: string | null, now: number): number | null {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.floor((now - t) / DAY) : null;
}

/** ¿Toca recordar la copia? Nunca con poco diario ni si se avisó hace poco. */
export function backupDue(lastBackup: string | null, lastNag: string | null, activeDays: number, now: number): boolean {
  if (activeDays < MIN_ACTIVE_DAYS) return false;
  const nag = daysSince(lastNag, now);
  if (nag !== null && nag < NAG_EVERY_DAYS) return false;
  const backup = daysSince(lastBackup, now);
  return backup === null || backup >= BACKUP_EVERY_DAYS;
}

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: no hay recordatorio */
  }
};

export const lastBackup = () => read(BACKUP_KEY);
export const lastNag = () => read(NAG_KEY);
export const markBackup = () => write(BACKUP_KEY, new Date().toISOString());
export const markNag = () => write(NAG_KEY, new Date().toISOString());
