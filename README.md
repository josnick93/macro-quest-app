# Macro Quest

App web (PWA) para registrar calorías y macros con estética RPG: misiones diarias, XP, niveles y rachas.

- Escáner de código de barras + búsqueda en Open Food Facts
- Alimentos propios, favoritos y recientes
- Recetas: ingredientes en crudo + peso final → macros por 100 g
- Progreso: peso corporal, medias de 7 días, XP y racha
- Perfil: plan de definición, mantenimiento o volumen según tus medidas (ritmo en kg/semana, % de grasa por medidas, peso objetivo con plazo, ajuste por día de la semana, gasto real calculado con tu diario y tu peso), exportar/importar datos

**Stack:** Vite · React 19 · TypeScript · Tailwind v4 · TanStack Query · Recharts · ZXing (wasm)

---

## Requisitos

- **Node.js 20.19+ o 22.12+** → `node -v`
- npm (viene con Node)

En Mac, si no tienes Node:
```bash
brew install node
```

## Arrancar en local

```bash
npm install
npm run dev
```
Abre http://localhost:5173

### Probar en el móvil (misma wifi)
```bash
npm run dev -- --host
```
Abre la URL `Network: http://192.168.x.x:5173` en el móvil.
> La cámara no funcionará aquí (requiere HTTPS). Para probar el escáner usa el despliegue.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run preview` | Sirve `dist/` en local para revisar la build |
| `npm test` | Tests unitarios (Vitest) |

`NO_SSL=1 npm run dev` arranca sin HTTPS (útil para navegadores que rechazan el certificado autofirmado).

## Desplegar (Cloudflare Pages, gratis)

1. Sube el código a GitHub.
2. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → elige `macro-quest-app`.
3. Configuración:
   - Framework preset: `Vite` (o ninguno)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Save and Deploy** → `https://macro-quest-app.pages.dev`

Cada `git push` a `main` vuelve a desplegar automáticamente.

### Instalar en el móvil
Abre la URL https → menú del navegador → **Añadir a pantalla de inicio**.

## Datos

- Todo se guarda en el navegador (IndexedDB, base `macro-quest`). Nada sale del dispositivo salvo las búsquedas a Open Food Facts.
- La primera vez se migran automáticamente los datos de la versión antigua (`localStorage`, prefijo `sysnutri:`); esas claves se conservan como copia.
- Versión de esquema y migraciones en `src/lib/repos/migrations.ts`. Cualquier cambio de formato lleva su migración.
- Cada navegador/dispositivo tiene sus propios datos.
- **Perfil → Exportar** para copia de seguridad (JSON); **Importar** para restaurarla (sustituye los datos; acepta también copias antiguas).

## Estructura

```
src/
  pages/        Hoy, Añadir, Recetas, Progreso, Perfil
  components/   Ventanas de sistema, barras, escáner, hojas modales…
  lib/
    nutrition.ts  Cálculos (TMB, TDEE, macros, recetas)
    xp.ts         Misiones, XP, niveles y rachas
    off.ts        Cliente de Open Food Facts
    hooks.ts      Hooks de datos (React Query)
    repos/        Capa de datos (IndexedDB) y migraciones
public/         manifest, icono, _redirects (SPA)
```

## Backend futuro

La app accede a los datos solo a través de `src/lib/repos`. Para usar un servidor (Go, PocketBase…) basta con crear un `repos/http.ts` que implemente las interfaces de `repos/types.ts` y cambiarlo en `repos/index.ts`.

## Créditos

Datos nutricionales de [Open Food Facts](https://openfoodfacts.org), bajo licencia [ODbL](https://opendatacommons.org/licenses/odbl/).
