// Plantilla del service worker. vite.config.ts sustituye la versión y la lista de archivos al compilar.
const CACHE = "mq-__VERSION__";
const FONTS = "mq-fonts";
const FILES = "__FILES__";
const SHELL = "/";
// ignoreVary: el servidor puede responder con "Vary: Origin" y la petición de la página (crossorigin) no coincidiría.
const MATCH = { cacheName: CACHE, ignoreVary: true };

self.addEventListener("install", (event) => {
  // Si falla la descarga de algún archivo, esta versión no se instala y sigue la anterior.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Tipografías: se sirven de caché y se refrescan en segundo plano.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONTS).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok || res.type === "opaque") cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      }),
    );
    return;
  }

  // Lo demás de otros orígenes (Open Food Facts…) va siempre a la red.
  if (url.origin !== self.location.origin) return;

  // Navegación: la app es una SPA, cualquier ruta abre el mismo index.html.
  if (req.mode === "navigate") {
    event.respondWith(caches.match(SHELL, MATCH).then((hit) => hit || fetch(req)));
    return;
  }

  event.respondWith(caches.match(req, MATCH).then((hit) => hit || fetch(req)));
});
