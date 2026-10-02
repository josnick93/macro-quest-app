# Macro Quest — contexto para Claude

App para registrar calorías y macros con estética RPG (ventanas de "sistema", XP, niveles, misiones diarias, rachas).
En español, móvil primero. Hoy es una web React; el objetivo es publicarla como app Android (iOS más adelante).

## Dirección de producto (actualizada 2026-09-30, prevalece sobre docs/PRODUCTO.md donde choquen)
- Primero: que sustituya a MyFitnessPal para uso propio (diario, recetas, código de barras, objetivos de mantenimiento/volumen/definición según medidas).
- **Prioridad: funcionalidades en la web.** Pasar a app es secundario y se hará después.
- Más adelante: app Android publicada en Google Play → iOS si sale rentable. Framework: pendiente de decidir (propuesta: Capacitor sobre esta misma base React, para no reescribir).
- Usuarios con login de Google y datos en la nube; monetización con banner de anuncios.
- Futuro: más salud (rutinas de gimnasio).

**Visión, funcionalidades objetivo y hoja de ruta: `docs/PRODUCTO.md` (léelo antes de proponer cambios).**

## Reglas
- Responde en español, conciso, con código directo. Nada de explicaciones largas.
- Estética inspirada en anime RPG, pero **sin nombres, personajes, logos ni frases de obras existentes** (nada de Solo Leveling explícito).
- Mobile-first: todo debe funcionar a 375 px de ancho y con el pulgar.
- Antes de dar algo por terminado: `npm run build` y `npm test` deben pasar sin errores.
- Commits pequeños y descriptivos. No hagas push sin que te lo pida.
- Git: este repo usa mi cuenta personal (`core.sshCommand` local con `~/.ssh/id_ed25519_personal`). **No toques la config global de git** (el Mac es del trabajo).

## Stack
Vite 8 · React 19 · TypeScript 5.9 · Tailwind v4 · react-router-dom 7 · TanStack Query · recharts 3 · lucide-react · sonner · barcode-detector (ponyfill zxing-wasm, wasm autoalojado).

## Estructura
```
src/
  pages/        TodayPage (diario por días, ?fecha=), AddPage (?fecha=&comida=), RecipesPage, ProgressPage (lazy), ProfilePage,
                WelcomePage (/bienvenida: primera vez, 3 pasos → perfil y objetivo), LoginPage (puerta de entrada)
  components/   SystemWindow, Sheet, BarcodeScanner (lazy), FoodPicker, MacroRing, XPBar, QuestItem…
  lib/
    types.ts      Modelos (Food, Entry, Recipe, Profile, Weight, Game…)
    nutrition.ts  Basal (Mifflin / Katch-McArdle con % de grasa), gasto, objetivos por día, % grasa (método Marina), macros de recetas
    goals.ts      Escenarios definición/mantenimiento/volumen, avisos de salud, plazo al peso objetivo, gasto real (TDEE adaptativo)
    xp.ts         Misiones, XP, niveles, rachas
    off.ts        Cliente Open Food Facts (ODbL): pregunta a /api/off/* (worker) y, si no existe o falla, a OFF directo. Mínimo 3 letras
    offApi.ts     URLs y validación de OFF, compartidas entre la app y el worker
    hooks.ts      Hooks React Query sobre los repos
    diary.ts      Copiar entradas, añadido rápido
    foods.ts      Recientes/frecuentes/última cantidad (derivados del diario), raciones, búsqueda unificada
    auth.ts       Sesión (/api/auth/me), cuenta recordada en el dispositivo y puerta de entrada (`gate`)
    syncApi.ts    Protocolo de sincronización, compartido entre la app y el worker (tipos, límites, validación)
    syncStatus.ts Estado visible de la copia en la nube
    repos/        Capa de datos: types.ts (interfaces), local.ts (IndexedDB), idb.ts (envoltorio IndexedDB),
                  migrations.ts (versión de esquema, normalización, import/export), sync.ts (sincronización con la nube), index.ts (selector)
worker/         Cloudflare Worker. index.ts: /api/off/search y /api/off/product/:código (reintentos ante 503, caché de Cloudflare,
                España primero y luego todo el catálogo); lo demás lo sirve desde dist.
                auth.ts + store.ts: login con Google (/api/auth/login|callback|me|logout|delete), usuarios y sesiones en D1.
                sync.ts: POST /api/sync (copia de los datos de cada usuario en la tabla `records` de D1).
                Tests en worker/*.test.ts (los de auth y sync usan una D1 local real vía wrangler)
```

## Arquitectura de datos
- La UI **solo** accede a datos vía `src/lib/hooks.ts` → `src/lib/repos`.
- Para cambiar a backend: crear `repos/http.ts` implementando `repos/types.ts` y cambiarlo en `repos/index.ts`. No meter fetch de datos propios en componentes.
- Datos en IndexedDB (base `macro-quest`). Los datos de la versión antigua (localStorage `sysnutri:*`) se migran solos la primera vez y se conservan como copia.
- **Cualquier cambio de formato de datos lleva migración** (`SCHEMA_VERSION` + paso en `MIGRATIONS` + `onupgradeneeded` si cambian los stores) y test. Nunca perder datos del usuario.
- Cada entrada del diario guarda una copia de los macros (`per100g`): editar un alimento no reescribe el pasado.
- Entidades con `updatedAt` y borrados registrados en `tombstones`: es lo que usa la sincronización (gana el último cambio).
- **Login obligatorio** donde el servidor lo tiene configurado (`gate` en `lib/auth.ts`). Sin conexión abre la última cuenta que entró en el dispositivo (`mq:account`); sin servidor de login (`npm run dev`) la app funciona sin cuentas.
- **Sincronización** (`repos/sync.ts` ↔ `worker/sync.ts`): cada escritura local apunta su clave en el store `outbox` (`markDirty`, que ya llaman `tombstone`/`untombstone`/`putKv`); toda escritura nueva de datos del usuario debe pasar por ahí o no se subirá. Se sincroniza al abrir, tras cada cambio (2,5 s), al volver a la app y al recuperar conexión.
  - Registros: gana el `updatedAt` más reciente. `kv` (perfil, ajustes, favoritos) lleva su fecha en `stamp:<clave>`. El juego (XP) no se pisa: se une con `mergeGame`.
  - `kv.sync` guarda de qué cuenta son los datos del dispositivo y el cursor. Si entra otra cuenta, la app no mezcla: pide cerrar sesión o borrar los datos locales.
  - Importar una copia fecha todo como "ahora", marca como borrado lo que no venga en ella y lo sube: la copia manda en todos los dispositivos.
  - Lo que llega del servidor se valida con `normalizeRecord` y compañía antes de guardarse.
  - Límite del plan gratuito de D1: 50 consultas por petición; por eso los cambios se guardan en una sola sentencia (`json_each`).
- Perfil (esquema v3): ritmo en kg/semana (`rateKgWeek`), medidas y % de grasa opcionales, `tdeeOverride` (gasto medido) y `weekdayKcal` (ajuste por día). Leer siempre con `normalizeProfile`.
- Sin perfil guardado (`isProfileSet` falso) la app lleva a `/bienvenida`; «Ahora no» vale solo esa sesión y Hoy avisa de que las kcal son de ejemplo. Nunca guardar el perfil de ejemplo por efecto secundario.
- El pesaje más reciente actualiza `profile.weightKg` (y cambiar el peso en Perfil registra un pesaje).
- Avisos de salud del plan: informativos y en ámbar, nunca bloquean.
- Gamificación: nunca quita XP ni castiga comer más; pasarse del objetivo se muestra en ámbar (`--over`), nunca en rojo.

## Comandos
- `npm run dev` · `npm run dev -- --host` (probar en el móvil por la red local)
- `NO_SSL=1 npm run dev` (sin HTTPS; para navegadores que rechazan el certificado autofirmado)
- `npm run build` (tsc + vite build) · `npm run preview`
- `npm run build && npx wrangler dev` (app compilada + worker en local, puerto 8787; con `.dev.vars` el login es obligatorio también ahí)
- `npm test` (Vitest; tests de la lógica pura de `lib/`: nutrición, objetivos, XP, diario, alimentos, migraciones)

## Notas
- Login: sesión en cookie `__Host-mq_session` (HttpOnly); en D1 solo se guarda el hash del token. Secretos `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en el panel de Cloudflare (en local, `.dev.vars`, que no se sube). Sin ellos la app funciona sin cuentas. El esquema de D1 se crea solo (`ensureSchema`).
- El service worker nunca intercepta `/api/*` (el login es una navegación).
- PWA: `sw.js` se genera al compilar (plugin en `vite.config.ts` + `src/sw.template.js`, sin dependencias) y precachea todos los archivos de la versión. Solo en producción; probar con `npm run build && NO_SSL=1 npm run preview`.
- Preferencias por dispositivo (no son datos del usuario, no se exportan): localStorage `mq:*` (escaneo continuo, fecha de la última copia y del último aviso).
- Escáner: la cámara en directo en iOS requiere HTTPS; por http en la red local funciona el botón "Hacer foto".
- Deploy: Cloudflare Workers (`wrangler.jsonc`: worker en `worker/index.ts` para `/api/*`, sirve `dist`, fallback SPA con `not_found_handling`). Build `npm run build`, deploy `npx wrangler deploy`. No usar `_redirects` con `/* /index.html 200`: en Workers se rechaza por bucle.
- Backend futuro: Go o PocketBase en una Orange Pi expuesta con Cloudflare Tunnel.
