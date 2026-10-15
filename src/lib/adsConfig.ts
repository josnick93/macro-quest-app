/** Configuración de AdSense, compartida entre la app y el build (ads.txt). Sin dependencias del navegador. */

export interface AdsConfig {
  client: string;
  slot: string;
}

const CLIENT = /^ca-pub-\d{10,20}$/;
const SLOT = /^\d{6,20}$/;

/** Configuración válida o null (valores ausentes o mal escritos: mejor sin anuncios que con una etiqueta rota). */
export function parseAdsConfig(client: string | undefined, slot: string | undefined): AdsConfig | null {
  const c = client?.trim() ?? "";
  const s = slot?.trim() ?? "";
  return CLIENT.test(c) && SLOT.test(s) ? { client: c, slot: s } : null;
}

/** Línea de ads.txt que Google pide en la raíz del dominio. */
export const adsTxt = (client: string) => `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`;

export const adsScriptUrl = (client: string) => `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
