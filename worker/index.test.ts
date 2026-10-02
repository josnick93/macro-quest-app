import { describe, expect, it } from "vitest";
import { cacheKey, product, route, search, upstream } from "./index";

const noWait = () => Promise.resolve();
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

/** Simula OFF: devuelve las respuestas en orden y apunta las URLs pedidas. */
function fakeOff(responses: (Response | Error)[]) {
  const urls: string[] = [];
  const fetcher = async (url: string) => {
    urls.push(url);
    const next = responses.shift();
    if (!next) throw new Error("sin más respuestas");
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetcher, urls };
}

describe("reintentos", () => {
  it("reintenta los 503 y los fallos de red hasta que responde", async () => {
    const off = fakeOff([new Response("", { status: 503 }), new Error("red"), ok({})]);
    expect((await upstream("https://x", off.fetcher, 3, noWait)).status).toBe(200);
    expect(off.urls).toHaveLength(3);
  });
  it("no reintenta un 404", async () => {
    const off = fakeOff([new Response("", { status: 404 })]);
    expect((await upstream("https://x", off.fetcher, 3, noWait)).status).toBe(404);
    expect(off.urls).toHaveLength(1);
  });
  it("si se agotan los intentos devuelve el último error", async () => {
    const off = fakeOff([new Response("", { status: 503 }), new Response("", { status: 503 }), new Response("", { status: 503 })]);
    expect((await upstream("https://x", off.fetcher, 3, noWait)).status).toBe(503);
  });
});

describe("búsqueda", () => {
  it("con resultados en España no consulta el resto", async () => {
    const off = fakeOff([ok({ products: [{ code: "1" }] })]);
    const res = await search("  Yogur  Griego ", off.fetcher, noWait);
    expect(await res.json()).toEqual({ products: [{ code: "1" }], scope: "es" });
    expect(off.urls).toHaveLength(1);
    expect(off.urls[0]).toContain("countries_tags_en=spain");
    expect(off.urls[0]).toContain("search_terms=yogur+griego");
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });
  it("sin resultados en España busca en todo el catálogo", async () => {
    const off = fakeOff([ok({ products: [] }), ok({ products: [{ code: "2" }] })]);
    const res = await search("skyr", off.fetcher, noWait);
    expect(await res.json()).toEqual({ products: [{ code: "2" }], scope: "world" });
    expect(off.urls[1]).not.toContain("countries_tags_en");
  });
  it("sin resultados en ningún sitio: lista vacía y caché corta", async () => {
    const res = await search("zzzzzz", fakeOff([ok({ products: [] }), ok({})]).fetcher, noWait);
    expect(await res.json()).toEqual({ products: [], scope: "world" });
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
  });
  it("rechaza búsquedas demasiado cortas o largas sin llamar a OFF", async () => {
    const off = fakeOff([]);
    expect((await search("yo", off.fetcher, noWait)).status).toBe(400);
    expect((await search("x".repeat(81), off.fetcher, noWait)).status).toBe(400);
    expect(off.urls).toHaveLength(0);
  });
  it("si OFF sigue caído responde 502 y no se guarda en caché", async () => {
    const down = () => new Response("", { status: 503 });
    const res = await search("yogur", fakeOff([down(), down(), down()]).fetcher, noWait);
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("código de barras", () => {
  it("producto encontrado", async () => {
    const res = await product("8480000123456", fakeOff([ok({ status: 1, product: { code: "8480000123456" } })]).fetcher, noWait);
    expect(await res.json()).toEqual({ product: { code: "8480000123456" } });
  });
  it("no encontrado no es un error", async () => {
    const res = await product("8480000123456", fakeOff([new Response("{}", { status: 404 })]).fetcher, noWait);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ product: null });
  });
  it("solo acepta códigos numéricos", async () => {
    const off = fakeOff([]);
    expect((await product("../../etc", off.fetcher, noWait)).status).toBe(400);
    expect(off.urls).toHaveLength(0);
  });
});

describe("rutas y caché", () => {
  it("solo existen las rutas de la API", () => {
    expect(route(new URL("https://app/api/off/search?q=yogur"))).not.toBeNull();
    expect(route(new URL("https://app/api/off/product/8480000123456"))).not.toBeNull();
    expect(route(new URL("https://app/api/otra"))).toBeNull();
  });
  it("la clave de caché ignora mayúsculas, espacios y parámetros ajenos", () => {
    expect(cacheKey(new URL("https://app/api/off/search?q=%20Yogur%20%20Griego&x=1"))).toBe(cacheKey(new URL("https://app/api/off/search?q=yogur+griego")));
  });
});
