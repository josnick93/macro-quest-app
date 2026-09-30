import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "node:path";

export default defineConfig({
  // basicSsl + host:true so the camera (getUserMedia) works when testing from a phone over LAN.
  // NO_SSL=1 serves plain http (localhost is a secure context anyway).
  plugins: [react(), tailwindcss(), ...(process.env.NO_SSL ? [] : [basicSsl()])],
  server: { host: true },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
