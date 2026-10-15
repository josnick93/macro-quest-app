import { normalizeText } from "./foods";

/**
 * Supermercados habituales: en la búsqueda de Open Food Facts salen primero sus productos.
 * Se reconocen por la tienda que indica OFF o por sus marcas propias.
 */

export interface Store {
  id: string;
  label: string;
  /** Nombre de la cadena y marcas propias de alimentación (sin tildes, en minúsculas). */
  match: string[];
}

export const STORES: Store[] = [
  { id: "mercadona", label: "Mercadona", match: ["mercadona", "hacendado"] },
  {
    id: "lidl",
    label: "Lidl",
    match: [
      "lidl",
      "milbona",
      "pikok",
      "chef select",
      "freeway",
      "fin carre",
      "crownfield",
      "snack day",
      "belbake",
      "vitasia",
      "italiamo",
      "sondey",
      "alesto",
      "combino",
      "baresa",
      "nixe",
      "golden seafood",
      "eridanous",
      "kania",
      "solevita",
    ],
  },
  { id: "carrefour", label: "Carrefour", match: ["carrefour"] },
  { id: "dia", label: "Dia", match: ["dia"] },
  { id: "alcampo", label: "Alcampo", match: ["alcampo", "auchan"] },
  { id: "eroski", label: "Eroski", match: ["eroski"] },
  { id: "aldi", label: "Aldi", match: ["aldi"] },
  { id: "consum", label: "Consum", match: ["consum"] },
];

export const isStoreId = (v: unknown): v is string => STORES.some((s) => s.id === v);

/** Palabras sueltas: "dia" no debe coincidir con "media" ni "diamante". */
const PATTERNS = new Map(STORES.map((s) => [s.id, new RegExp(`(^|[^a-z0-9])(${s.match.join("|")})($|[^a-z0-9])`)]));

/** Cadenas (de las elegidas) que venden el producto según sus marcas y tiendas en OFF. */
export function storesOf(text: string, chosen: readonly string[]): string[] {
  const hay = normalizeText(text);
  return chosen.filter((id) => PATTERNS.get(id)?.test(hay));
}

/** Primero lo de tus supermercados, manteniendo el orden de OFF dentro de cada grupo. */
export function rankByStores<T extends { stores: string }>(hits: T[], chosen: readonly string[]): T[] {
  if (!chosen.length) return hits;
  const mine = hits.filter((h) => storesOf(h.stores, chosen).length > 0);
  return [...mine, ...hits.filter((h) => !mine.includes(h))];
}
