import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

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
      // Cloudflare Pages redirige /index.html a /, y una respuesta redirigida no sirve para navegar: se guarda "/".
      const hash = createHash("sha256");
      const files: string[] = [];
      for (const [name, item] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        if (name.endsWith(".map")) continue;
        files.push(name === "index.html" ? "/" : `/${name}`);
        hash.update(name).update(item.type === "chunk" ? item.code : item.source);
      }
      const publicDir = path.resolve(import.meta.dirname, "public");
      for (const name of readdirSync(publicDir).sort()) {
        if (name.startsWith("_")) continue; // _redirects, _headers: configuración del alojamiento
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

export default defineConfig({
  // basicSsl + host:true so the camera (getUserMedia) works when testing from a phone over LAN.
  // NO_SSL=1 serves plain http (localhost is a secure context anyway).
  plugins: [react(), tailwindcss(), ...(process.env.NO_SSL ? [] : [basicSsl()]), serviceWorker()],
  server: { host: true },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
