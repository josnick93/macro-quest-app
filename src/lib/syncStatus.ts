import { useSyncExternalStore } from "react";
import type { SyncErrorCode } from "./repos/sync";

/** Estado de la copia en la nube, para enseñarlo en la app. Vive en memoria: se recalcula al abrir. */
export interface SyncStatus {
  state: "idle" | "syncing" | "error";
  /** Última sincronización completada en esta sesión (ISO). */
  lastAt: string | null;
  error: SyncErrorCode | null;
}

let status: SyncStatus = { state: "idle", lastAt: null, error: null };
const listeners = new Set<() => void>();

export function setSyncStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

export const useSyncStatus = () => useSyncExternalStore(subscribe, () => status);

/** Texto corto del estado, para la ventana de la cuenta. */
export function syncLabel(s: SyncStatus, pending: number): string {
  if (s.state === "syncing") return "Sincronizando…";
  if (s.state === "error") {
    if (s.error === "network") return pending > 0 ? "Sin conexión: tus cambios se subirán al volver" : "Sin conexión";
    if (s.error === "unauthorized") return "La sesión ha caducado: vuelve a entrar";
    return "No se pudo sincronizar. Se volverá a intentar.";
  }
  if (pending > 0) return "Cambios pendientes de subir";
  return s.lastAt ? "Copia en la nube al día" : "Copia en la nube";
}
