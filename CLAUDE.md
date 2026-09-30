# Macro Quest — contexto para Claude

App web (PWA) personal para registrar calorías y macros con estética RPG (ventanas de "sistema", XP, niveles, misiones diarias, rachas).
Uso personal, en español, pensada para móvil (iPhone Safari/Chrome).

**Visión, funcionalidades objetivo y hoja de ruta: `docs/PRODUCTO.md` (léelo antes de proponer cambios).**

## Reglas
- Responde en español, conciso, con código directo. Nada de explicaciones largas.
- Estética inspirada en anime RPG, pero **sin nombres, personajes, logos ni frases de obras existentes** (nada de Solo Leveling explícito).
- Mobile-first: todo debe funcionar a 375 px de ancho y con el pulgar.
- Antes de dar algo por terminado: `npm run build` debe pasar sin errores.
- Commits pequeños y descriptivos. No hagas push sin que te lo pida.
- Git: este repo usa mi cuenta personal (`core.sshCommand` local con `~/.ssh/id_ed25519_personal`). **No toques la config global de git** (el Mac es del trabajo).

## Stack
Vite 8 · React 19 · TypeScript 5.9 · Tailwind v4 · react-router-dom 7 · TanStack Query · recharts 3 · lucide-react · sonner · barcode-detector (ponyfill zxing-wasm, wasm autoalojado).

## Estructura
```
src/
  pages/        TodayPage, AddPage, RecipesPage, ProgressPage (lazy), ProfilePage
  components/   SystemWindow, Sheet, BarcodeScanner (lazy), FoodPicker, MacroRing, XPBar, QuestItem…
  lib/
    types.ts      Modelos (Food, Entry, Recipe, Profile, Weight, Game…)
    nutrition.ts  Mifflin-St Jeor, TDEE, objetivos, macros de recetas (crudo + peso cocinado → /100 g)
    xp.ts         Misiones, XP, niveles, rachas
    off.ts        Cliente Open Food Facts (ODbL)
    hooks.ts      Hooks React Query sobre los repos
    repos/        Capa de datos: types.ts (interfaces), local.ts (localStorage, prefijo "sysnutri:"), index.ts (selector)
```

## Arquitectura de datos
- La UI **solo** accede a datos vía `src/lib/hooks.ts` → `src/lib/repos`.
- Para cambiar a backend: crear `repos/http.ts` implementando `repos/types.ts` y cambiarlo en `repos/index.ts`. No meter fetch de datos propios en componentes.

## Comandos
- `npm run dev` · `npm run dev -- --host` (probar en el móvil por la red local)
- `npm run build` (tsc + vite build) · `npm run preview`

## Notas
- Escáner: la cámara en directo en iOS requiere HTTPS; por http en la red local funciona el botón "Hacer foto".
- Deploy previsto: Cloudflare Pages (build `npm run build`, salida `dist`, `public/_redirects` para SPA).
- Backend futuro: Go o PocketBase en una Orange Pi expuesta con Cloudflare Tunnel.
