import { useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SystemWindow } from "./SystemWindow";
import { syncNow, useAccount, useDeleteAccount, useLogout, useSession, useSyncPending } from "@/lib/hooks";
import { syncLabel, useSyncStatus } from "@/lib/syncStatus";

/** Cuenta de Google en uso. No aparece donde no hay login (desarrollo sin servidor). */
export function AccountWindow() {
  const { data: session } = useSession();
  const account = useAccount();
  const logout = useLogout();
  const remove = useDeleteAccount();
  const status = useSyncStatus();
  const pending = useSyncPending();
  const [confirming, setConfirming] = useState(false);

  if (!account) return null;
  const offline = session?.offline !== false;

  return (
    <SystemWindow title="Cuenta" scan={false}>
      <p className="truncate text-sm">{account.name ?? account.email}</p>
      {account.name && <p className="text-muted-foreground truncate text-xs">{account.email}</p>}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className={status.state === "error" || offline ? "text-over text-xs" : "text-muted-foreground text-xs"}>
          {offline ? "Sin conexión: tus cambios se subirán al volver" : syncLabel(status, pending)}
        </p>
        <button
          type="button"
          className="btn-ghost min-h-11 shrink-0 px-3 text-xs"
          onClick={syncNow}
          disabled={offline || status.state === "syncing"}
          aria-label="Sincronizar ahora"
        >
          <RefreshCw className={status.state === "syncing" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </button>
      </div>
      <p className="text-muted-foreground mt-1 text-[11px]">Tu diario se guarda en la nube y se comparte entre tus dispositivos.</p>
      <button type="button" className="btn-ghost mt-3 min-h-11 w-full" onClick={() => logout.mutate()} disabled={logout.isPending || offline}>
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
      {confirming ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs">Se borrarán del servidor tu cuenta y la copia de tus datos. Lo que hay en este dispositivo no se toca.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost min-h-11 text-xs" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-ghost text-over min-h-11 text-xs"
              disabled={remove.isPending}
              onClick={() => remove.mutate(undefined, { onSuccess: () => (setConfirming(false), toast.success("Cuenta borrada")) })}
            >
              Borrar cuenta
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="text-muted-foreground mt-2 min-h-11 w-full text-xs underline disabled:opacity-50" onClick={() => setConfirming(true)} disabled={offline}>
          Borrar mi cuenta
        </button>
      )}
    </SystemWindow>
  );
}
