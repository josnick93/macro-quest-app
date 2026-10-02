import { describe, expect, it } from "vitest";
import { loginMessage } from "./auth";

describe("resultado del login", () => {
  it("traduce lo que devuelve el servidor", () => {
    expect(loginMessage("ok")).toMatchObject({ ok: true });
    expect(loginMessage("cancelado")).toMatchObject({ ok: false });
    expect(loginMessage("error")).toMatchObject({ ok: false });
  });
  it("ignora valores desconocidos", () => {
    expect(loginMessage(null)).toBeNull();
    expect(loginMessage("<script>")).toBeNull();
  });
});
