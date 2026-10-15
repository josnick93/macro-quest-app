import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { adsTxt, parseAdsClient } from "./src/lib/adsConfig.ts";

/**
 * Genera /sw.js al compilar, con la lista de archivos de esa versión para que la app abra sin conexión.
 * Sin dependencias: la plantilla está en src/sw.template.js.
 */
function serviceWorker(): Plugin {
  return {
    name: "macro-quest-sw",
    apply: "build",
    enforce: "post",
    async generateBundle(_, bundle) {
      // Cloudflare redirige /index.html a /, y una respuesta redirigida no sirve para navegar: se guarda "/".
      const hash = createHash("sha256");
      const files: string[] = [];
      for (const [name, item] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        if (name.endsWith(".map")) continue;
        files.push(name === "index.html" ? "/" : `/${name}`);
        hash.update(name).update(item.type === "chunk" ? item.code : item.source);
      }
      const publicDir = path.resolve(import.meta.dirname, "public");
      for (const name of readdirSync(publicDir).sort()) {
        if (name.startsWith("_")) continue; // _headers: configuración del alojamiento
        if (name.endsWith(".html")) continue; // páginas estáticas (legales, guía): Cloudflare redirige /x.html a /x y siempre van a la red
        files.push(`/${name}`);
        hash.update(name).update(readFileSync(path.join(publicDir, name)));
      }
      const template = await this.fs.readFile(path.resolve(import.meta.dirname, "src/sw.template.js"), { encoding: "utf8" });
      const version = hash.update(template).digest("hex").slice(0, 10);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template.replace("__VERSION__", version).replace('"__FILES__"', JSON.stringify(files)),
      });
    },
  };
}

/** /ads.txt para AdSense, en cuanto hay ID de editor. */
function adsFile(mode: string): Plugin {
  return {
    name: "macro-quest-ads-txt",
    apply: "build",
    generateBundle() {
      const env = loadEnv(mode, import.meta.dirname, "VITE_ADSENSE_");
      const client = parseAdsClient(env.VITE_ADSENSE_CLIENT);
      if (client) this.emitFile({ type: "asset", fileName: "ads.txt", source: adsTxt(client) });
    },
  };
}

/**
 * Verificación del sitio en AdSense: la etiqueta `google-adsense-account` en la página principal.
 * El script de anuncios solo se carga dentro de la app (tras el login), así que el revisor no lo vería.
 */
function adsVerification(mode: string): Plugin {
  return {
    name: "macro-quest-ads-verification",
    apply: "build",
    transformIndexHtml() {
      const env = loadEnv(mode, import.meta.dirname, "VITE_ADSENSE_");
      const client = parseAdsClient(env.VITE_ADSENSE_CLIENT);
      return client ? [{ tag: "meta", attrs: { name: "google-adsense-account", content: client }, injectTo: "head" }] : [];
    },
  };
}

export default defineConfig(({ mode }) => ({
  // basicSsl + host:true so the camera (getUserMedia) works when testing from a phone over LAN.
  // NO_SSL=1 serves plain http (localhost is a secure context anyway).
  plugins: [react(), tailwindcss(), ...(process.env.NO_SSL ? [] : [basicSsl()]), adsFile(mode), adsVerification(mode), serviceWorker()],
  server: { host: true },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
}));
