/**
 * Anuncios (Google AdSense): un único banner fijo de 320×50, solo en producción y solo si están configurados
 * `VITE_ADSENSE_CLIENT` (ca-pub-…) y `VITE_ADSENSE_SLOT` al compilar. Sin ellos no se carga nada de Google.
 * El aviso de consentimiento (RGPD) lo muestra el propio script de AdSense con «Privacidad y mensajes».
 */

import { adsScriptUrl, parseAdsConfig, type AdsConfig } from "./adsConfig";

export type { AdsConfig };

export const ADS: AdsConfig | null = import.meta.env.PROD
  ? parseAdsConfig(import.meta.env.VITE_ADSENSE_CLIENT, import.meta.env.VITE_ADSENSE_SLOT)
  : null;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    googlefc?: { callbackQueue?: unknown[]; showRevocationMessage?: () => void };
  }
}

let loading: Promise<void> | null = null;

/** Carga el script de AdSense una sola vez. */
export function loadAdsScript(client: string): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = adsScriptUrl(client);
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null; // bloqueador o sin red: se reintenta en la próxima pantalla
      s.remove();
      reject(new Error("AdSense no disponible"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Vuelve a abrir el aviso de consentimiento de Google para cambiar o retirar el permiso. */
export function showAdsConsent(): void {
  const fc = (window.googlefc ??= {});
  (fc.callbackQueue ??= []).push(() => window.googlefc?.showRevocationMessage?.());
}
