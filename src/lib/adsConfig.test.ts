import { describe, expect, it } from "vitest";
import { adsScriptUrl, adsTxt, parseAdsConfig } from "./adsConfig";

describe("configuración de anuncios", () => {
  it("sin valores o mal escritos no hay anuncios", () => {
    expect(parseAdsConfig(undefined, undefined)).toBeNull();
    expect(parseAdsConfig("ca-pub-1234567890123456", undefined)).toBeNull();
    expect(parseAdsConfig("pub-1234567890123456", "1234567890")).toBeNull();
    expect(parseAdsConfig("ca-pub-1234567890123456", "abc")).toBeNull();
    expect(parseAdsConfig('ca-pub-123"><script>', "1234567890")).toBeNull();
  });

  it("acepta los IDs de AdSense y quita espacios", () => {
    expect(parseAdsConfig(" ca-pub-1234567890123456 ", "1234567890\n")).toEqual({ client: "ca-pub-1234567890123456", slot: "1234567890" });
  });

  it("ads.txt y URL del script", () => {
    expect(adsTxt("ca-pub-1234567890123456")).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
    expect(adsScriptUrl("ca-pub-1")).toBe("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1");
  });
});
