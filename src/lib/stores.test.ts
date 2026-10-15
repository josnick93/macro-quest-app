import { describe, expect, it } from "vitest";
import { rankByStores, storesOf } from "./stores";

describe("supermercados habituales", () => {
  it("reconoce la cadena por la tienda o por su marca propia", () => {
    expect(storesOf("Hacendado, ", ["mercadona", "lidl"])).toEqual(["mercadona"]);
    expect(storesOf("Milbona, Lidl", ["mercadona", "lidl"])).toEqual(["lidl"]);
    expect(storesOf("Danone, Mercadona,Carrefour", ["mercadona", "lidl"])).toEqual(["mercadona"]);
    expect(storesOf("Fin Carré, ", ["lidl"])).toEqual(["lidl"]);
  });

  it("solo palabras enteras y solo las cadenas elegidas", () => {
    expect(storesOf("Media Naranja, Diamante", ["dia"])).toEqual([]);
    expect(storesOf("Dia, ", ["dia"])).toEqual(["dia"]);
    expect(storesOf("Hacendado, Mercadona", [])).toEqual([]);
  });

  it("pone primero tus supermercados sin desordenar el resto", () => {
    const hits = [
      { id: 1, stores: "Danone, Carrefour" },
      { id: 2, stores: "Hacendado, Mercadona" },
      { id: 3, stores: "Pascual, " },
      { id: 4, stores: "Milbona, Lidl" },
    ];
    expect(rankByStores(hits, ["mercadona", "lidl"]).map((h) => h.id)).toEqual([2, 4, 1, 3]);
    expect(rankByStores(hits, []).map((h) => h.id)).toEqual([1, 2, 3, 4]);
  });
});
