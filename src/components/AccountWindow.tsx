import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { SystemWindow } from "./SystemWindow";
import { loginMessage, startLogin } from "@/lib/auth";
import { useDeleteAccount, useLogout, useSession } from "@/lib/hooks";

/** Cuenta de Google. No aparece si el servidor no tiene el login configurado (o no hay conexión). */
export function AccountWindow() {
  const { data: session } = useSession();
  const logout = useLogout();
  const remove = useDeleteAccount();
  const [params, setParams] = useSearchParams();
  const [confirming, setConfirming] = useState(false);

  // Resultado del login al volver de Google: se muestra una vez y se limpia de la URL.
  const result = params.get("login");
  const motivo = params.get("motivo");
  useEffect(() => {
    const msg = loginMessage(result, motivo);
    if (!msg) return;
    if (msg.ok) toast.success(msg.text);
    else toast.info(msg.text, { duration: 15_000 });
    setParams((p) => (p.delete("login"), p.delete("motivo"), p), { replace: true });
  }, [result, motivo, setParams]);

  if (!session.enabled) return null;

  if (!session.user) {
    return (
      <SystemWindow title="Cuenta" scan={false}>
        <p className="text-sm">Entra con tu cuenta de Google para identificarte.</p>
        <button type="button" className="btn-primary mt-3 min-h-12 w-full" onClick={startLogin}>
          <LogIn className="h-4 w-4" /> Entrar con Google
        </button>
        <p className="text-muted-foreground mt-3 text-[11px]">
          Solo se guardan tu nombre y tu correo. De momento tu diario sigue únicamente en este dispositivo; la copia en la nube llegará en una
          próxima versión.
        </p>
      </SystemWindow>
    );
  }

  return (
    <SystemWindow title="Cuenta" scan={false}>
      <p className="truncate text-sm">{session.user.name ?? session.user.email}</p>
      {session.user.name && <p className="text-muted-foreground truncate text-xs">{session.user.email}</p>}
      <p className="text-muted-foreground mt-2 text-[11px]">
        Tu diario sigue únicamente en este dispositivo; la copia en la nube llegará en una próxima versión.
      </p>
      <button type="button" className="btn-ghost mt-3 min-h-11 w-full" onClick={() => logout.mutate()} disabled={logout.isPending}>
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
        <button type="button" className="text-muted-foreground mt-2 min-h-11 w-full text-xs underline" onClick={() => setConfirming(true)}>
          Borrar mi cuenta
        </button>
      )}
    </SystemWindow>
  );
}
