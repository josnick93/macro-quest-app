import { describe, expect, it } from "vitest";
import { canonicalUrl, isLegacyHost, legacyRedirect } from "./domain";

const OLD = "https://macro-quest-app.josecaudevilla93.workers.dev";
const u = (path: string, origin = OLD) => new URL(path, origin);

describe("mudanza a macroquestapp.com", () => {
  it("solo el dominio viejo", () => {
    expect(isLegacyHost("macro-quest-app.josecaudevilla93.workers.dev")).toBe(true);
    expect(isLegacyHost("macroquestapp.com")).toBe(false);
    expect(isLegacyHost("localhost")).toBe(false);
    expect(legacyRedirect("GET", u("/", "https://macroquestapp.com"), null)).toBeNull();
  });

  it("sin sesión: redirige conservando ruta y parámetros", () => {
    expect(legacyRedirect("GET", u("/proteina"), null)).toBe("https://macroquestapp.com/proteina");
    expect(legacyRedirect("GET", u("/?fecha=2026-10-01"), "otra=1")).toBe("https://macroquestapp.com/?fecha=2026-10-01");
    expect(canonicalUrl(u("/anadir?comida=cena#x"))).toBe("https://macroquestapp.com/anadir?comida=cena#x");
  });

  it("no toca la API, el service worker, otros métodos ni a quien tiene sesión", () => {
    expect(legacyRedirect("GET", u("/api/auth/me"), null)).toBeNull();
    expect(legacyRedirect("POST", u("/api/sync"), null)).toBeNull();
    expect(legacyRedirect("GET", u("/sw.js"), null)).toBeNull();
    expect(legacyRedirect("POST", u("/"), null)).toBeNull();
    expect(legacyRedirect("GET", u("/"), "a=1; __Host-mq_session=abc")).toBeNull();
  });
});
