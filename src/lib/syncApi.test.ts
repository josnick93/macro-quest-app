import { describe, expect, it } from "vitest";
import { EPOCH, parseChange, stamp, type Change } from "./syncApi";
import { syncLabel } from "./syncStatus";

const change = (key: string, data = "{}"): Change => ({ store: "diary", key, updatedAt: "2026-10-02T10:00:00.000Z", deleted: false, data });

describe("marcas de tiempo", () => {
  it("deja las válidas y normaliza el resto para poder compararlas como texto", () => {
    expect(stamp("2026-10-02T10:00:00.000Z")).toBe("2026-10-02T10:00:00.000Z");
    expect(stamp("2026-10-02T12:00:00+02:00")).toBe("2026-10-02T10:00:00.000Z");
    expect(stamp(undefined)).toBe(EPOCH);
    expect(stamp("ayer")).toBe(EPOCH);
  });
});

describe("validación de cambios", () => {
  it("acepta guardados y borrados bien formados", () => {
    expect(parseChange(change("e1"))).toEqual(change("e1"));
    expect(parseChange({ store: "weights", key: "2026-10-02", updatedAt: "2026-10-02T10:00:00.000Z", deleted: true, data: "x" })).toEqual({
      store: "weights",
      key: "2026-10-02",
      updatedAt: "2026-10-02T10:00:00.000Z",
      deleted: true,
      data: null,
    });
    expect(parseChange({ ...change("profile"), store: "kv" })).not.toBeNull();
  });
  it("rechaza almacenes desconocidos, claves internas, fechas raras y registros vacíos o enormes", () => {
    expect(parseChange(null)).toBeNull();
    expect(parseChange({ ...change("e1"), store: "tombstones" })).toBeNull();
    expect(parseChange({ ...change("sync"), store: "kv" })).toBeNull();
    expect(parseChange({ ...change("e1"), updatedAt: "2026-10-02" })).toBeNull();
    expect(parseChange({ ...change(""), key: "" })).toBeNull();
    expect(parseChange({ ...change("e1"), data: null })).toBeNull();
    expect(parseChange(change("e1", "x".repeat(200_001)))).toBeNull();
  });
});

describe("estado visible", () => {
  it("explica qué pasa sin alarmar", () => {
    expect(syncLabel({ state: "syncing", lastAt: null, error: null }, 0)).toBe("Sincronizando…");
    expect(syncLabel({ state: "idle", lastAt: "2026-10-02T10:00:00.000Z", error: null }, 0)).toBe("Copia en la nube al día");
    expect(syncLabel({ state: "idle", lastAt: null, error: null }, 3)).toBe("Cambios pendientes de subir");
    expect(syncLabel({ state: "error", lastAt: null, error: "network" }, 2)).toContain("se subirán");
    expect(syncLabel({ state: "error", lastAt: null, error: "unauthorized" }, 0)).toContain("vuelve a entrar");
  });
});
