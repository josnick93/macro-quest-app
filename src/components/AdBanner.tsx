import { useEffect, useRef, useState } from "react";
import { ADS, loadAdsScript } from "@/lib/ads";

/**
 * Banner de 320×50 al final de la pantalla, con su hueco reservado para que nada salte al cargar.
 * Sin configuración, sin conexión o si no hay anuncio que mostrar, no ocupa nada.
 */
export function AdBanner() {
  const ref = useRef<HTMLModElement>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!ADS || !online) return;
    const el = ref.current;
    let cancelled = false;
    loadAdsScript(ADS.client)
      .then(() => {
        // Cada <ins> se rellena una sola vez; AdSense marca los ya procesados.
        if (cancelled || !el || el.dataset.adsbygoogleStatus) return;
        (window.adsbygoogle ??= []).push({});
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [online]);

  if (!ADS || !online || failed) return null;
  return (
    <aside aria-label="Publicidad" className="ad-slot mx-auto w-[320px] max-w-full">
      <p className="text-muted-foreground mb-1 text-center text-[10px] tracking-widest uppercase">Publicidad</p>
      <ins
        ref={ref}
        className="adsbygoogle block h-[50px] w-[320px]"
        data-ad-client={ADS.client}
        data-ad-slot={ADS.slot}
      />
    </aside>
  );
}
