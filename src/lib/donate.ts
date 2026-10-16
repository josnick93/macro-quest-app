/** Enlace de donación (`VITE_DONATE_URL` al compilar). Solo páginas conocidas y por https: mal escrito, no sale nada. */

const HOSTS = ["ko-fi.com", "buymeacoffee.com", "www.buymeacoffee.com", "paypal.me", "www.paypal.me"];

export function parseDonateUrl(raw: string | undefined): string | null {
  try {
    const url = new URL(raw?.trim() ?? "");
    return url.protocol === "https:" && HOSTS.includes(url.hostname) && url.pathname.length > 1 ? url.href : null;
  } catch {
    return null;
  }
}

export const DONATE_URL = parseDonateUrl(import.meta.env.VITE_DONATE_URL);
