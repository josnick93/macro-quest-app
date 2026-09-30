# Macro Quest — Visión de producto y hoja de ruta

> Documento para Claude Code. Léelo entero antes de proponer o implementar nada.
> Complementa a `CLAUDE.md` (reglas técnicas y de estilo).

---

## 1. Qué quiero construir

Un **contador de calorías y macros completo, al nivel de las apps grandes del sector** (MyFitnessPal, Yazio, Lose It!, Cronometer, MacroFactor), pero:

- **Mío**: sin anuncios, sin suscripción, sin muros de pago, datos bajo mi control.
- **Rápido**: registrar una comida debe costar **menos de 10 segundos** en el caso habitual.
- **Gamificado**: cada día es una "misión", el progreso se ve como subir de nivel en un RPG. La estética es de "ventanas de sistema" de anime (paneles azul neón, tipografía técnica, avisos tipo notificación), **sin usar nombres, personajes, logos ni frases de ninguna obra existente**.
- **En español** y pensada para **móvil (iPhone)** como PWA instalada en la pantalla de inicio.

Usuario principal: yo (José Ángel), uso diario. A futuro puede que la usen 1–5 personas más (pareja, amigos), por eso el backend debe soportar varios usuarios, pero **no es un producto comercial**.

### Referencias: qué copiar de cada una (funcionalidad, NO marca ni diseño)
| App | Lo que me gusta |
|---|---|
| MyFitnessPal | Diario por comidas (desayuno/comida/merienda/cena/snacks), búsqueda enorme, escáner, "comidas recientes/frecuentes", copiar comida de otro día, quick add de kcal |
| MacroFactor | Objetivos que se **ajustan solos** según la evolución real del peso (TDEE adaptativo), registro sin culpa, sin colores rojos agresivos |
| Cronometer | Micronutrientes (fibra, azúcar, sal/sodio, grasas saturadas), precisión de datos |
| Yazio / Lose It! | Onboarding claro, resumen visual del día muy limpio, agua, rachas |

---

## 2. Estado actual (ya hecho)

Vite + React 19 + TS + Tailwind v4 + TanStack Query. Datos en `localStorage` vía capa de repositorios (`src/lib/repos`).

- **Hoy**: anillo de kcal, barras de macros, misiones diarias, XP/nivel/racha, lista de entradas por comida.
- **Añadir**: buscador Open Food Facts, escáner de código de barras (ZXing wasm + foto + manual), alimentos propios, favoritos, recientes.
- **Recetas**: ingredientes en crudo + peso final cocinado → macros por 100 g; registrar ración.
- **Progreso**: gráfica de peso, kcal de los últimos 7 días vs objetivo, medias, XP.
- **Perfil**: datos corporales, objetivos Mifflin-St Jeor + actividad + déficit, exportar/importar JSON.

**Revisa el código real antes de asumir nada de esta lista.**

---

## 3. Funcionalidades objetivo

Prioridad: **P0** imprescindible · **P1** muy deseable · **P2** cuando haya tiempo.

### 3.1 Diario (núcleo) — P0
- Vista por día con navegación ← hoy → y selector de calendario.
- Secciones por comida: Desayuno, Almuerzo, Comida, Merienda, Cena, Snacks (configurable en ajustes: renombrar/ocultar).
- Cada sección muestra kcal y macros subtotal; botón "+" directo a añadir en esa comida.
- Editar cantidad de una entrada con un toque (gramos, raciones o unidades: "1 huevo", "1 rebanada").
- Deslizar para borrar / mover a otra comida / duplicar.
- **Copiar comida** de ayer o de cualquier día ("Copiar desayuno de ayer").
- **Quick add**: añadir solo kcal (+ macros opcionales) sin alimento.
- Nota de texto libre por día.

### 3.2 Base de alimentos y búsqueda — P0
- Búsqueda unificada: mis alimentos → recetas → historial → Open Food Facts (en ese orden, con debounce y caché).
- Pestañas: Recientes · Frecuentes · Favoritos · Mis alimentos · Recetas · Comidas guardadas.
- **Raciones por alimento**: 100 g, ración del envase, unidades personalizadas ("1 yogur = 125 g").
- Crear alimento propio desde la etiqueta nutricional (formulario rápido; P2: foto de la etiqueta con OCR).
- Corregir/sobrescribir datos de un producto de Open Food Facts localmente.
- Micronutrientes opcionales por alimento: fibra, azúcares, grasa saturada, sal.

### 3.3 Escáner — P0 (ya existe, pulir)
- Tras escanear: ficha del producto con cantidad preseleccionada (última usada de ese producto o ración del envase) → un toque para añadir.
- Si no existe en OFF: crear alimento propio con ese código de barras asociado.
- Escaneo continuo opcional para varios productos seguidos.

### 3.4 Comidas guardadas y recetas — P1
- **Comida guardada** = conjunto de alimentos que se registra de golpe ("Mi desayuno habitual").
- Guardar la comida actual como comida guardada con un toque.
- Recetas (ya existen): añadir raciones ("esta receta son 4 raciones"), foto opcional, duplicar receta.

### 3.5 Objetivos — P0 / P1
- P0: kcal y macros en gramos **o** porcentaje; objetivo de proteína por kg de peso.
- P1: objetivos **distintos por día de la semana** (ej. más carbos días de gym).
- P1: **TDEE adaptativo** estilo MacroFactor: con el peso medio móvil (7 días) y las kcal registradas de las últimas 2–4 semanas, estimar el gasto real y proponer ajustar objetivo semanalmente (el usuario acepta o no).
- Modos: perder / mantener / ganar, con ritmo (kg/semana).

### 3.6 Progreso y análisis — P1
- Peso: registro diario, **media móvil de 7 días** (línea suave) sobre los puntos reales, tendencia semanal, proyección hasta el peso objetivo.
- Medidas corporales opcionales (cintura, pecho, brazo…) y fotos de progreso (P2, locales).
- Informes: semana y mes — media de kcal, macros, % días cumplidos, adherencia, alimentos más consumidos, reparto de macros por comida.
- Calendario "heatmap" de días cumplidos.

### 3.7 Agua, ejercicio y pasos — P1
- Agua: vasos/ml con objetivo diario, botones rápidos (+250 ml, +500 ml).
- Ejercicio: registro manual con kcal quemadas (lista de actividades comunes con MET × peso × minutos). Opción en ajustes: sumar o no las kcal de ejercicio al objetivo.
- P2: pasos manuales. (Integración con Apple Health no es posible desde una PWA; no perder tiempo en eso.)

### 3.8 Gamificación (la capa que me diferencia) — P0 / P1
Todo con vocabulario de RPG/"sistema", sin referencias a obras existentes.
- **Misiones diarias** (ya existen): registrar todas las comidas, llegar a proteína, quedar dentro de ±10 % de kcal, agua, pesarse.
- **Misiones semanales** (P1): 5 de 7 días en objetivo, pesarse 4 veces, probar una receta nueva…
- **XP y niveles** (ya existen): revisar curva para que subir no sea ni trivial ni imposible.
- **Rachas** con "escudo" de racha (1 día de perdón por semana) para no castigar un mal día.
- **Estadísticas de personaje** (P1): FUE, AGI, VIT, INT… derivadas de hábitos reales (ej. VIT = constancia de registro, FUE = días cumpliendo proteína). Pantalla de "ficha de personaje".
- **Logros/títulos** (P1): "Primer escaneo", "30 días de racha", "100 alimentos registrados"…
- **Notificaciones del sistema** in-app al completar misiones o subir de nivel (animación ya existe en `LevelUpWindow`).
- Regla: la gamificación **nunca castiga** comer más; premia constancia y registro honesto.

### 3.9 Ajustes y datos — P0
- Unidades (kg/lb, kcal/kJ), comidas visibles, primer día de la semana.
- Exportar/importar JSON (ya existe) + exportar CSV del diario.
- Borrar todos los datos con confirmación.

### 3.10 PWA y offline — P0
- Instalable (manifest + iconos), service worker: la app abre y permite registrar **sin conexión**; las búsquedas de OFF fallan con elegancia.
- Recordatorios (P2): notificaciones push web en iOS 16.4+ si la PWA está instalada ("¿Has registrado la comida?").

### 3.11 Backend y multi-dispositivo — P1 (fase posterior)
- Backend propio en **Go + SQLite** (o PocketBase) en una Orange Pi, expuesto con Cloudflare Tunnel.
- Auth simple (email + contraseña o magic link), multiusuario.
- Sincronización: la app sigue funcionando offline con `localStorage`/IndexedDB y sincroniza cuando hay red (last-write-wins por entidad con `updatedAt`).
- Implementado como `src/lib/repos/http.ts` que cumple `repos/types.ts`. La UI no debe cambiar.

### Fuera de alcance (no hacer)
- Social/feed/amigos, anuncios, pagos, IA de fotos de platos, integración con wearables nativos, app nativa.

---

## 4. Principios de UX

1. **Velocidad ante todo**: el flujo más común (alimento reciente, misma cantidad) = 2 toques.
2. **Pulgar**: acciones principales abajo; hojas modales desde abajo (`Sheet`); objetivos táctiles ≥ 44 px.
3. **Sin culpa**: pasarse del objetivo se muestra en color neutro/ámbar, nunca rojo alarmante.
4. **Datos honestos**: mostrar siempre de dónde viene un alimento (OFF, propio, receta) y permitir corregirlo.
5. **Consistencia visual**: usar `SystemWindow`, `Sheet`, `MacroLine`, `StatBar`, tokens de color de `styles.css`. No introducir librerías de UI nuevas sin preguntar.
6. **Estados vacíos útiles**: cada pantalla vacía explica qué hacer y tiene un botón para hacerlo.
7. **Accesible**: contraste suficiente, `aria-label` en botones de icono, respeta `prefers-reduced-motion`.

---

## 5. Modelo de datos (orientativo, ajustar al código real)

- `Food` { id, name, brand?, barcode?, per100g: {kcal, protein, carbs, fat, fiber?, sugar?, satFat?, salt?}, servings: [{label, grams}], source: "off"|"custom"|"recipe", updatedAt }
- `Entry` { id, date, meal, foodId | recipeId | quickAdd, grams | servings, snapshot de macros, updatedAt }
- `SavedMeal` { id, name, items: [{foodId, grams}] }
- `Recipe` { id, name, ingredients, cookedWeight, servings?, photo? }
- `Weight` { date, kg } · `Measurement` { date, type, cm }
- `Water` { date, ml } · `Exercise` { id, date, name, minutes, kcal }
- `Goals` { kcal, protein, carbs, fat, mode, rate, byWeekday? }
- `Game` { xp, level, streak, shields, achievements[], history[] }

Guardar un **snapshot de macros en cada `Entry`** para que editar un alimento no reescriba el pasado.
Incluir migraciones de versión en `repos/local.ts` si cambia el esquema (no romper datos existentes).

---

## 6. Hoja de ruta por fases

Trabaja **una fase cada vez**. Al empezar cada fase: plan corto → espera mi OK → implementa → `npm run build` → resumen de cambios.

| Fase | Contenido | Criterio de "hecho" |
|---|---|---|
| **0. Auditoría** | Leer todo, listar bugs, deuda técnica y huecos frente a este documento | Informe priorizado, sin cambios de código |
| **1. Diario sólido** | Navegación por días, secciones por comida con subtotales, editar/mover/duplicar/borrar entrada, copiar comida, quick add, snapshots en entradas + migración | Puedo registrar un día completo en < 2 min y copiar el desayuno de ayer en 2 toques |
| **2. Alimentos pro** | Búsqueda unificada con pestañas, raciones/unidades, frecuentes, comidas guardadas, micros opcionales, flujo post-escaneo | Alimento habitual en 2 toques; producto nuevo escaneado en < 15 s |
| **3. PWA offline** | Service worker, manifest/iconos, funcionamiento sin red, deploy en Cloudflare Pages | Instalada en iPhone, abre en modo avión y registra |
| **4. Progreso** | Media móvil de peso, tendencia, informes semanales/mensuales, heatmap, medidas | Veo mi tendencia real y la adherencia del mes de un vistazo |
| **5. Objetivos inteligentes** | Objetivos por día de semana, TDEE adaptativo con propuesta semanal | Tras 3 semanas de datos me propone un ajuste razonable |
| **6. Gamificación 2.0** | Misiones semanales, escudos de racha, stats de personaje, logros, ficha de personaje | Hay algo nuevo que desbloquear cada semana |
| **7. Agua y ejercicio** | Registro, objetivo, impacto opcional en kcal | Integrado en Hoy y en misiones |
| **8. Backend** | Go + SQLite en Orange Pi, auth, `repos/http.ts`, sync offline-first | Mismo diario en móvil y PC |

---

## 7. Cómo quiero que trabajes

- Español, conciso, código directo.
- Antes de cambios grandes: plan en viñetas y espera confirmación.
- Cambios pequeños y verificables; commit por funcionalidad (sin push salvo que lo pida).
- Si algo de este documento choca con el código existente o es mala idea técnicamente, dilo y propón alternativa.
- Tests: añade tests unitarios (Vitest) para la lógica pura de `lib/` (nutrición, XP, TDEE adaptativo, migraciones) cuando la toques.
- Nunca pierdas datos del usuario: cualquier cambio de esquema lleva migración.
