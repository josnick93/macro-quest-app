import { LogIn, RefreshCw, WifiOff } from "lucide-react";
import { SystemWindow } from "@/components/SystemWindow";
import { startLogin } from "@/lib/auth";

/** Puerta de entrada: sin cuenta no se usa la app, así los datos están en la nube desde el primer día. */
export function LoginPage({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-8">
      <SystemWindow title="Macro Quest">
        <p className="text-sm">Registra lo que comes, cumple tus misiones diarias y sube de nivel.</p>
        {offline ? (
          <>
            <p className="text-over mt-4 flex items-center gap-2 text-sm">
              <WifiOff className="h-4 w-4 shrink-0" /> Sin conexión. Hace falta internet para entrar la primera vez.
            </p>
            <button type="button" className="btn-primary mt-4 min-h-12 w-full" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary mt-4 min-h-12 w-full" onClick={startLogin}>
            <LogIn className="h-4 w-4" /> Entrar con Google
          </button>
        )}
        <p className="text-muted-foreground mt-4 text-[11px]">
          Se guardan tu nombre, tu correo y una copia de tu diario, para que lo tengas en todos tus dispositivos y no se pierda. Puedes borrarlo
          todo cuando quieras desde Perfil.
        </p>
        <p className="text-muted-foreground mt-2 text-[11px]">
          <a className="underline" href="/privacidad">
            Privacidad
          </a>
          {" · "}
          <a className="underline" href="/condiciones">
            Condiciones
          </a>
        </p>
      </SystemWindow>
    </div>
  );
}
