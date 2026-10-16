/** URLs de Open Food Facts. Lo comparten la app y el servidor intermedio (worker/). */

export const OFF_BASE = "https://world.openfoodfacts.org";

export const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_es",
  // Las marcas blancas multinacionales (Lidl, Aldi…) a menudo solo tienen el nombre en otro idioma.
  "generic_name_es",
  "product_name_en",
  "product_name_fr",
  "product_name_it",
  "product_name_pt",
  "product_name_de",
  "product_name_nl",
  "brands",
  "stores",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "product_quantity",
].join(",");

/** Sube al cambiar `OFF_FIELDS`: invalida las respuestas guardadas en la caché del worker. */
export const OFF_CACHE_VERSION = "2";

/** OFF limita la búsqueda (~10 peticiones/min por IP): solo se consulta a partir de 3 letras. */
export const MIN_REMOTE_QUERY = 3;
export const MAX_REMOTE_QUERY = 80;

/** Texto de búsqueda normalizado (también es la clave de caché). */
export const normalizeQuery = (q: string): string => q.trim().toLowerCase().replace(/\s+/g, " ");

export const isBarcode = (code: string): boolean => /^\d{6,14}$/.test(code);

/** `es`: solo productos vendidos en España · `world`: todo el catálogo. */
export type SearchScope = "es" | "world";

export function searchUrl(query: string, scope: SearchScope): string {
  const params: Record<string, string> = {
    search_terms: normalizeQuery(query),
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "25",
    fields: OFF_FIELDS,
  };
  if (scope === "es") params.countries_tags_en = "spain";
  return `${OFF_BASE}/cgi/search.pl?${new URLSearchParams(params).toString()}`;
}

export const productUrl = (barcode: string): string => `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
