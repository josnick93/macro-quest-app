import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { SystemWindow } from "./SystemWindow";
import { useAccount, useDeleteAccount, useLogout, useSession } from "@/lib/hooks";

/** Cuenta de Google en uso. No aparece donde no hay login (desarrollo sin servidor). */
export function AccountWindow() {
  const { data: session } = useSession();
  const account = useAccount();
  const logout = useLogout();
  const remove = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);

  if (!account) return null;
  const offline = session?.offline !== false;

  return (
    <SystemWindow title="Cuenta" scan={false}>
      <p className="truncate text-sm">{account.name ?? account.email}</p>
      {account.name && <p className="text-muted-foreground truncate text-xs">{account.email}</p>}
      <button type="button" className="btn-ghost mt-3 min-h-11 w-full" onClick={() => logout.mutate()} disabled={logout.isPending || offline}>
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
      {confirming ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs">Se borrarán tu nombre y tu correo del servidor. Lo que hay en este dispositivo no se toca.</p>
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
