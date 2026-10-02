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
  pages/        TodayPage (diario por días, ?fecha=), AddPage (?fecha=&comida=), RecipesPage, ProgressPage (lazy), ProfilePage
  components/   SystemWindow, Sheet, BarcodeScanner (lazy), FoodPicker, MacroRing, XPBar, QuestItem…
  lib/
    types.ts      Modelos (Food, Entry, Recipe, Profile, Weight, Game…)
    nutrition.ts  Basal (Mifflin / Katch-McArdle con % de grasa), gasto, objetivos por día, % grasa (método Marina), macros de recetas
    goals.ts      Escenarios definición/mantenimiento/volumen, avisos de salud, plazo al peso objetivo, gasto real (TDEE adaptativo)
    xp.ts         Misiones, XP, niveles, rachas
    off.ts        Cliente Open Food Facts (ODbL). La búsqueda da 503 intermitentes y limita ~10/min: reintentos + caché + mínimo 3 letras
    hooks.ts      Hooks React Query sobre los repos
    diary.ts      Copiar entradas, añadido rápido
    foods.ts      Recientes/frecuentes/última cantidad (derivados del diario), raciones, búsqueda unificada
    repos/        Capa de datos: types.ts (interfaces), local.ts (IndexedDB), idb.ts (envoltorio IndexedDB),
                  migrations.ts (versión de esquema, normalización, import/export), index.ts (selector)
```

## Arquitectura de datos
- La UI **solo** accede a datos vía `src/lib/hooks.ts` → `src/lib/repos`.
- Para cambiar a backend: crear `repos/http.ts` implementando `repos/types.ts` y cambiarlo en `repos/index.ts`. No meter fetch de datos propios en componentes.
- Datos en IndexedDB (base `macro-quest`). Los datos de la versión antigua (localStorage `sysnutri:*`) se migran solos la primera vez y se conservan como copia.
- **Cualquier cambio de formato de datos lleva migración** (`SCHEMA_VERSION` + paso en `MIGRATIONS` + `onupgradeneeded` si cambian los stores) y test. Nunca perder datos del usuario.
- Cada entrada del diario guarda una copia de los macros (`per100g`): editar un alimento no reescribe el pasado.
- Entidades con `updatedAt` y borrados registrados en `tombstones` (para sync last-write-wins futura).
- Perfil (esquema v3): ritmo en kg/semana (`rateKgWeek`), medidas y % de grasa opcionales, `tdeeOverride` (gasto medido) y `weekdayKcal` (ajuste por día). Leer siempre con `normalizeProfile`.
- El pesaje más reciente actualiza `profile.weightKg` (y cambiar el peso en Perfil registra un pesaje).
- Avisos de salud del plan: informativos y en ámbar, nunca bloquean.
- Gamificación: nunca quita XP ni castiga comer más; pasarse del objetivo se muestra en ámbar (`--over`), nunca en rojo.

## Comandos
- `npm run dev` · `npm run dev -- --host` (probar en el móvil por la red local)
- `NO_SSL=1 npm run dev` (sin HTTPS; para navegadores que rechazan el certificado autofirmado)
- `npm run build` (tsc + vite build) · `npm run preview`
- `npm test` (Vitest; tests de la lógica pura de `lib/`: nutrición, objetivos, XP, diario, alimentos, migraciones)

## Notas
- PWA: `sw.js` se genera al compilar (plugin en `vite.config.ts` + `src/sw.template.js`, sin dependencias) y precachea todos los archivos de la versión. Solo en producción; probar con `npm run build && NO_SSL=1 npm run preview`.
- Preferencias por dispositivo (no son datos del usuario, no se exportan): localStorage `mq:*` (escaneo continuo, fecha de la última copia y del último aviso).
- Escáner: la cámara en directo en iOS requiere HTTPS; por http en la red local funciona el botón "Hacer foto".
- Deploy: Cloudflare Workers con archivos estáticos (`wrangler.jsonc`: sirve `dist`, fallback SPA con `not_found_handling`). Build `npm run build`, deploy `npx wrangler deploy`. No usar `_redirects` con `/* /index.html 200`: en Workers se rechaza por bucle.
- Backend futuro: Go o PocketBase en una Orange Pi expuesta con Cloudflare Tunnel.
