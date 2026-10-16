import { describe, expect, it } from "vitest";
import { parseDonateUrl } from "./donate";

describe("enlace de donación", () => {
  it("acepta páginas de donación por https", () => {
    expect(parseDonateUrl(" https://ko-fi.com/macroquest ")).toBe("https://ko-fi.com/macroquest");
    expect(parseDonateUrl("https://www.buymeacoffee.com/mq")).toBe("https://www.buymeacoffee.com/mq");
  });

  it("rechaza vacío, http, otras webs y la portada sin usuario", () => {
    expect(parseDonateUrl(undefined)).toBeNull();
    expect(parseDonateUrl("")).toBeNull();
    expect(parseDonateUrl("http://ko-fi.com/macroquest")).toBeNull();
    expect(parseDonateUrl("https://ko-fi.com.evil.example/x")).toBeNull();
    expect(parseDonateUrl("https://ko-fi.com/")).toBeNull();
    expect(parseDonateUrl("ko-fi.com/macroquest")).toBeNull();
  });
});
