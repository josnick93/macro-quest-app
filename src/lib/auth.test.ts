import { describe, expect, it } from "vitest";
import { activeAccount, gate, loginMessage, type SessionInfo, type SessionUser } from "./auth";

describe("resultado del login", () => {
  it("traduce lo que devuelve el servidor", () => {
    expect(loginMessage("ok")).toMatchObject({ ok: true });
    expect(loginMessage("cancelado")).toMatchObject({ ok: false });
    expect(loginMessage("error")).toMatchObject({ ok: false });
    expect(loginMessage("error", "sin_cookie")?.text).toContain("(sin_cookie)");
    expect(loginMessage("error", "<script>")?.text).not.toContain("script");
  });
  it("ignora valores desconocidos", () => {
    expect(loginMessage(null)).toBeNull();
    expect(loginMessage("<script>")).toBeNull();
  });
});

describe("puerta de entrada", () => {
  const ana: SessionUser = { id: "g-1", email: "ana@example.com", name: "Ana" };
  const server = (user: SessionUser | null): SessionInfo => ({ enabled: true, user, offline: false });
  const offline: SessionInfo = { enabled: false, user: null, offline: true };
  const noServer: SessionInfo = { enabled: false, user: null, offline: false };

  it("con login en el servidor, entrar es obligatorio", () => {
    expect(gate(server(null), null)).toBe("login");
    expect(gate(server(ana), null)).toBe("open");
    // La sesión ha caducado: la cuenta recordada ya no vale.
    expect(gate(server(null), ana)).toBe("login");
  });
  it("sin conexión abre quien ya entró en este dispositivo", () => {
    expect(gate(offline, ana)).toBe("open");
    expect(gate(offline, null)).toBe("login");
    expect(activeAccount(offline, ana)).toEqual(ana);
  });
  it("mientras se pregunta al servidor no hace esperar a quien ya entró", () => {
    expect(gate(undefined, ana)).toBe("open");
    expect(gate(undefined, null)).toBe("loading");
  });
  it("sin servidor de login la app funciona sin cuentas", () => {
    expect(gate(noServer, null)).toBe("open");
    expect(activeAccount(noServer, ana)).toBeNull();
  });
});
