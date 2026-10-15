import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { SystemWindow } from "./SystemWindow";
import { CANONICAL_ORIGIN, canonicalUrl, isLegacyHost } from "@/lib/domain";
import { useSyncPending } from "@/lib/hooks";
import { useSyncStatus } from "@/lib/syncStatus";

const LEGACY = import.meta.env.PROD && isLegacyHost(location.hostname);

/** Instalada en la pantalla de inicio: no se puede cambiar de dominio desde dentro, hay que reinstalarla. */
const installed = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/**
 * En el dominio viejo, con sesión: espera a que la copia en la nube esté al día (sin cambios pendientes) y entonces
 * lleva a macroquestapp.com. Instalada como app, en lugar de redirigir explica cómo reinstalarla.
 */
export function DomainMove({ signedIn }: { signedIn: boolean }) {
  const status = useSyncStatus();
  const pending = useSyncPending();
  const [later, setLater] = useState(false);
  const synced = signedIn && status.state === "idle" && status.lastAt !== null && pending === 0;
  const app = LEGACY && installed();

  useEffect(() => {
    if (LEGACY && synced && !app) location.replace(canonicalUrl(new URL(location.href)));
  }, [synced, app]);

  if (!LEGACY || !app || later) return null;
  const host = new URL(CANONICAL_ORIGIN).host;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <SystemWindow title="Nueva dirección" className="mx-auto w-full max-w-lg">
        <p className="text-sm">
          Macro Quest se ha mudado a <strong>{host}</strong>. Ábrela allí y vuelve a añadirla a la pantalla de inicio; luego puedes borrar este
          icono.
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          {synced
            ? "Tus datos ya están en la nube: los tendrás al entrar con tu cuenta."
            : signedIn
              ? "Subiendo tus últimos cambios a la nube…"
              : "Entra con tu cuenta para subir tus datos antes de mudarte."}
        </p>
        <a className="btn-primary mt-4 w-full" href={CANONICAL_ORIGIN} target="_blank" rel="noopener">
          <ExternalLink className="h-4 w-4" /> Abrir {host}
        </a>
        <button type="button" className="btn-ghost mt-2 w-full" onClick={() => setLater(true)}>
          Ahora no
        </button>
      </SystemWindow>
    </div>
  );
}
