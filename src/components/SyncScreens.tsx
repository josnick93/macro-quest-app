import { useState } from "react";
import { LoaderCircle, LogOut, RefreshCw, TriangleAlert } from "lucide-react";
import { SystemWindow } from "./SystemWindow";
import type { SessionUser } from "@/lib/auth";
import { syncNow, useLogout, useSyncPending, useWipeLocal } from "@/lib/hooks";
import { useSyncStatus } from "@/lib/syncStatus";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-8">{children}</div>
);

/** Primera sincronización en un dispositivo sin perfil: se espera a ver si los datos ya están en la nube. */
export function FirstSync({ onSkip }: { onSkip: () => void }) {
  const status = useSyncStatus();
  const failed = status.state === "error";
  return (
    <Frame>
      <SystemWindow title="Sincronizando">
        {failed ? (
          <>
            <p className="text-over flex items-center gap-2 text-sm">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              {status.error === "network" ? "Sin conexión." : "No se pudo sincronizar."}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Si ya usas Macro Quest en otro dispositivo, reintenta para traer tus datos antes de seguir.
            </p>
            <button type="button" className="btn-primary mt-4 min-h-12 w-full" onClick={syncNow}>
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
            <button type="button" className="text-muted-foreground mt-2 min-h-11 w-full text-xs underline" onClick={onSkip}>
              Seguir sin sincronizar
            </button>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm">
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /> Buscando tus datos en la nube…
          </p>
        )}
      </SystemWindow>
    </Frame>
  );
}

/** Los datos de este dispositivo son de otra cuenta: no se mezclan nunca sin que el usuario lo decida. */
export function OtherAccount({ ownerEmail, account }: { ownerEmail: string; account: SessionUser }) {
  const logout = useLogout();
  const wipe = useWipeLocal();
  const pending = useSyncPending();
  const [confirming, setConfirming] = useState(false);
  return (
    <Frame>
      <SystemWindow title="Otra cuenta">
        <p className="text-sm">
          Este dispositivo tiene los datos de <span className="font-semibold break-words">{ownerEmail}</span> y has entrado como{" "}
          <span className="font-semibold break-words">{account.email}</span>. Cierra sesión para entrar con la otra cuenta.
        </p>
        <button type="button" className="btn-primary mt-4 min-h-12 w-full" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
        {confirming ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs">
              Se borrarán de este dispositivo los datos de {ownerEmail}.{" "}
              {pending > 0
                ? `Hay ${pending} cambios que aún no se habían subido a su copia en la nube y se perderán.`
                : "Su copia en la nube no se toca."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost min-h-11 text-xs" onClick={() => setConfirming(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-ghost text-over min-h-11 text-xs" disabled={wipe.isPending} onClick={() => wipe.mutate()}>
                Borrar y usar esta cuenta
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="text-muted-foreground mt-2 min-h-11 w-full text-xs underline" onClick={() => setConfirming(true)}>
            Usar este dispositivo con {account.email}
          </button>
        )}
      </SystemWindow>
    </Frame>
  );
}
