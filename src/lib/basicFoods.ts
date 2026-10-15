import type { Food, Nutrients, Serving } from "./types";
import { normalizeText } from "./foods";

/**
 * Alimentos básicos sin marca (fruta, verdura, carne, pescado, legumbres…), incluidos en la app.
 * Valores medios por 100 g de porción comestible, en crudo salvo que el nombre diga otra cosa.
 * Hidratos sin la fibra, como en las etiquetas europeas. Fuente: tablas de composición de referencia y etiquetas habituales.
 *
 * El id (`base:<nombre>`) lo guardan las entradas del diario y los favoritos: no cambiar un nombre ya publicado
 * sin mantener su id (`id` explícito).
 */

export const BASIC_PREFIX = "base:";

export type BasicCategory =
  | "Fruta"
  | "Verdura"
  | "Legumbres"
  | "Cereales y pan"
  | "Carne y huevos"
  | "Pescado y marisco"
  | "Lácteos"
  | "Aceites y frutos secos"
  | "Otros";

type Micro = Partial<Pick<Nutrients, "fiber" | "sugar" | "satFat" | "salt">>;
type Row = [name: string, macros: [kcal: number, protein: number, carbs: number, fat: number], micro?: Micro, servings?: Serving[], id?: string];

const u = (label: string, grams: number): Serving => ({ label, grams });

const DATA: Record<BasicCategory, Row[]> = {
  Fruta: [
    ["Manzana", [52, 0.3, 11.4, 0.2], { fiber: 2.4, sugar: 10.4 }, [u("1 manzana mediana", 180)]],
    ["Plátano", [89, 1.1, 20.2, 0.3], { fiber: 2.6, sugar: 12.2 }, [u("1 plátano (pelado)", 120)]],
    ["Naranja", [47, 0.9, 9.4, 0.1], { fiber: 2.4, sugar: 9.4 }, [u("1 naranja (pelada)", 150)]],
    ["Mandarina", [53, 0.8, 11.5, 0.3], { fiber: 1.8, sugar: 10.6 }, [u("1 mandarina (pelada)", 70)]],
    ["Pera", [57, 0.4, 12.1, 0.1], { fiber: 3.1, sugar: 9.8 }, [u("1 pera mediana", 170)]],
    ["Melocotón", [39, 0.9, 8.4, 0.3], { fiber: 1.5, sugar: 8.4 }, [u("1 melocotón", 150)]],
    ["Fresas", [32, 0.7, 5.7, 0.3], { fiber: 2, sugar: 4.9 }, [u("1 fresa", 12)]],
    ["Uvas", [69, 0.7, 17.2, 0.2], { fiber: 0.9, sugar: 15.5 }, [u("1 racimo pequeño", 100)]],
    ["Kiwi", [61, 1.1, 11.7, 0.5], { fiber: 3, sugar: 9 }, [u("1 kiwi (pelado)", 75)]],
    ["Piña", [50, 0.5, 11.7, 0.1], { fiber: 1.4, sugar: 9.9 }, [u("1 rodaja", 80)]],
    ["Sandía", [30, 0.6, 7.2, 0.2], { fiber: 0.4, sugar: 6.2 }, [u("1 tajada", 250)]],
    ["Melón", [34, 0.8, 7.9, 0.2], { fiber: 0.9, sugar: 7.9 }, [u("1 tajada", 200)]],
    ["Mango", [60, 0.8, 13.7, 0.4], { fiber: 1.6, sugar: 13.7 }, [u("1 mango (pulpa)", 200)]],
    ["Cerezas", [63, 1.1, 13.9, 0.2], { fiber: 2.1, sugar: 12.8 }, [u("1 puñado", 80)]],
    ["Ciruela", [46, 0.7, 10, 0.3], { fiber: 1.4, sugar: 9.9 }, [u("1 ciruela", 60)]],
    ["Arándanos", [57, 0.7, 12.1, 0.3], { fiber: 2.4, sugar: 10 }, [u("1 tarrina", 125)]],
    ["Aguacate", [160, 2, 1.8, 14.7], { fiber: 6.7, sugar: 0.7, satFat: 2.1 }, [u("1 aguacate (pulpa)", 150), u("medio aguacate", 75)]],
  ],
  Verdura: [
    ["Tomate", [18, 0.9, 2.7, 0.2], { fiber: 1.2, sugar: 2.6 }, [u("1 tomate mediano", 120)]],
    ["Lechuga", [15, 1.4, 1.6, 0.2], { fiber: 1.3, sugar: 0.8 }, [u("1 plato", 50)]],
    ["Pepino", [15, 0.7, 3.1, 0.1], { fiber: 0.5, sugar: 1.7 }, [u("1 pepino", 200)]],
    ["Zanahoria", [41, 0.9, 6.8, 0.2], { fiber: 2.8, sugar: 4.7 }, [u("1 zanahoria", 70)]],
    ["Cebolla", [40, 1.1, 7.6, 0.1], { fiber: 1.7, sugar: 4.2 }, [u("1 cebolla mediana", 110)]],
    ["Pimiento rojo", [31, 1, 4.2, 0.3], { fiber: 2.1, sugar: 4.2 }, [u("1 pimiento", 150)]],
    ["Pimiento verde", [20, 0.9, 2.9, 0.2], { fiber: 1.7, sugar: 2.4 }, [u("1 pimiento", 120)]],
    ["Calabacín", [17, 1.2, 2.5, 0.3], { fiber: 1, sugar: 2.5 }, [u("1 calabacín", 250)]],
    ["Berenjena", [25, 1, 3.5, 0.2], { fiber: 3, sugar: 3.5 }, [u("1 berenjena", 300)]],
    ["Brócoli", [34, 2.8, 4, 0.4], { fiber: 2.6, sugar: 1.7 }],
    ["Coliflor", [25, 1.9, 3, 0.3], { fiber: 2, sugar: 1.9 }],
    ["Espinacas", [23, 2.9, 1.4, 0.4], { fiber: 2.2, sugar: 0.4 }],
    ["Judías verdes", [31, 1.8, 4.3, 0.2], { fiber: 2.7, sugar: 3.3 }],
    ["Champiñones", [22, 3.1, 2.3, 0.3], { fiber: 1, sugar: 2 }],
    ["Espárragos verdes", [20, 2.2, 1.9, 0.1], { fiber: 2.1, sugar: 1.9 }, [u("1 manojo", 250)]],
    ["Alcachofa", [47, 3.3, 5.1, 0.2], { fiber: 5.4, sugar: 1 }, [u("1 alcachofa (comestible)", 50)]],
    ["Calabaza", [26, 1, 6, 0.1], { fiber: 0.5, sugar: 2.8 }],
    ["Puerro", [61, 1.5, 12.4, 0.3], { fiber: 1.8, sugar: 3.9 }, [u("1 puerro", 90)]],
    ["Ajo", [149, 6.4, 30.9, 0.5], { fiber: 2.1, sugar: 1 }, [u("1 diente", 4)]],
    ["Guisantes (congelados)", [77, 5.2, 9.1, 0.4], { fiber: 4.5 }],
    ["Patata", [77, 2, 15.3, 0.1], { fiber: 2.2, sugar: 0.8 }, [u("1 patata mediana", 170)]],
    ["Patata cocida", [86, 1.7, 18.2, 0.1], { fiber: 1.8 }],
    ["Boniato", [86, 1.6, 17.1, 0.1], { fiber: 3, sugar: 4.2 }, [u("1 boniato", 200)]],
    ["Tomate triturado (conserva)", [28, 1.4, 4.5, 0.2], { fiber: 1.5, sugar: 3.5, salt: 0.2 }],
    ["Tomate frito", [77, 1.5, 10, 3.5], { fiber: 1.5, sugar: 7, salt: 1.2 }, [u("1 cucharada", 15)]],
  ],
  Legumbres: [
    ["Lentejas (secas)", [352, 24.6, 52.7, 1.1], { fiber: 10.7, sugar: 2 }, [u("1 ración", 70)]],
    ["Lentejas cocidas", [116, 9, 12.2, 0.4], { fiber: 7.9, sugar: 1.8 }, [u("1 bote escurrido", 250)]],
    ["Garbanzos (secos)", [378, 20.5, 50.8, 6], { fiber: 12.2, sugar: 10.7 }, [u("1 ración", 70)]],
    ["Garbanzos cocidos", [164, 8.9, 19.8, 2.6], { fiber: 7.6, sugar: 4.8 }, [u("1 bote escurrido", 250)]],
    ["Alubias blancas (secas)", [333, 23.4, 45.1, 0.9], { fiber: 15.2 }, [u("1 ración", 70)]],
    ["Alubias cocidas", [139, 9.7, 18.8, 0.4], { fiber: 6.3 }, [u("1 bote escurrido", 250)]],
    ["Tofu firme", [144, 17.3, 0.6, 8.7], { fiber: 2.3, satFat: 1.3 }],
    ["Hummus", [166, 7.9, 8.3, 9.6], { fiber: 6, salt: 1.2 }, [u("1 cucharada", 15)]],
  ],
  "Cereales y pan": [
    ["Arroz blanco (crudo)", [365, 7.1, 78.7, 0.7], { fiber: 1.3, sugar: 0.1 }, [u("1 ración", 80)]],
    ["Arroz blanco cocido", [130, 2.7, 27.8, 0.3], { fiber: 0.4 }, [u("1 plato", 200)]],
    ["Arroz integral (crudo)", [370, 7.9, 73.7, 2.9], { fiber: 3.5, sugar: 0.9 }, [u("1 ración", 80)]],
    ["Pasta (cruda)", [371, 13, 71.5, 1.5], { fiber: 3.2, sugar: 2.7 }, [u("1 ración", 80)]],
    ["Pasta cocida", [158, 5.8, 29.1, 0.9], { fiber: 1.8 }, [u("1 plato", 200)]],
    ["Pan blanco (barra)", [270, 9, 53, 1.6], { fiber: 2.5, sugar: 2.5, salt: 1.2 }, [u("1 rebanada", 30), u("1 bocadillo (1/3 de barra)", 80)]],
    ["Pan integral", [250, 10, 42, 3.5], { fiber: 7, sugar: 3, salt: 1.1 }, [u("1 rebanada", 30)]],
    ["Pan de molde", [265, 8, 47, 4], { fiber: 2.7, sugar: 5, salt: 1.2 }, [u("1 rebanada", 25)]],
    ["Copos de avena", [375, 13.5, 58.7, 7], { fiber: 10, sugar: 1, satFat: 1.3 }, [u("1 ración", 40)]],
    ["Copos de maíz", [378, 7, 84, 0.9], { fiber: 3, sugar: 8, salt: 1.1 }, [u("1 bol", 30)]],
    ["Harina de trigo", [350, 10.3, 73, 1.1], { fiber: 2.7, sugar: 0.3 }],
    ["Quinoa (cruda)", [368, 14.1, 57.2, 6.1], { fiber: 7 }, [u("1 ración", 70)]],
    ["Cuscús (crudo)", [376, 12.8, 72.4, 0.6], { fiber: 5 }, [u("1 ración", 70)]],
    ["Tortitas de arroz", [387, 8.2, 77.3, 2.8], { fiber: 4.2, salt: 0.1 }, [u("1 tortita", 8)]],
    ["Galletas tipo María", [430, 7, 75, 11], { fiber: 2.5, sugar: 23, satFat: 1.5, salt: 0.6 }, [u("1 galleta", 6)]],
  ],
  "Carne y huevos": [
    ["Pechuga de pollo", [110, 23, 0, 2], { satFat: 0.6, salt: 0.2 }, [u("1 filete", 125)]],
    ["Muslo de pollo (sin piel)", [116, 19.7, 0, 4.1], { satFat: 1.1, salt: 0.2 }, [u("1 contramuslo", 90)]],
    ["Pechuga de pavo", [108, 23.7, 0, 1.5], { satFat: 0.4, salt: 0.2 }, [u("1 filete", 125)]],
    ["Ternera magra (filete)", [131, 21.4, 0, 5], { satFat: 2, salt: 0.2 }, [u("1 filete", 150)]],
    ["Carne picada de vacuno", [215, 18.6, 0, 15], { satFat: 5.9, salt: 0.2 }],
    ["Lomo de cerdo", [141, 21, 0, 6.3], { satFat: 2.2, salt: 0.1 }, [u("1 filete", 100)]],
    ["Jamón serrano", [241, 31, 0, 13], { satFat: 4.5, salt: 4.5 }, [u("1 loncha", 15)]],
    ["Jamón cocido", [107, 19, 1, 3], { satFat: 1, salt: 2 }, [u("1 loncha", 15)]],
    ["Pechuga de pavo (fiambre)", [98, 18, 3, 1.5], { satFat: 0.5, salt: 2 }, [u("1 loncha", 12)]],
    ["Chorizo", [455, 24, 2, 39], { satFat: 14, salt: 4.4 }, [u("1 rodaja", 6)]],
    ["Huevo", [143, 12.6, 0.7, 9.5], { satFat: 3.1, salt: 0.4 }, [u("1 huevo L", 58), u("1 huevo M", 50)]],
    ["Clara de huevo", [52, 10.9, 0.7, 0.2], { salt: 0.4 }, [u("1 clara", 33)]],
  ],
  "Pescado y marisco": [
    ["Merluza", [76, 17, 0, 0.9], { satFat: 0.2, salt: 0.2 }, [u("1 filete", 150)]],
    ["Salmón", [203, 20.4, 0, 13.4], { satFat: 3, salt: 0.1 }, [u("1 lomo", 150)]],
    ["Atún fresco", [109, 24.4, 0, 0.5], { satFat: 0.2, salt: 0.1 }, [u("1 filete", 150)]],
    ["Atún al natural (lata, escurrido)", [105, 24, 0, 1], { satFat: 0.3, salt: 0.9 }, [u("1 lata pequeña", 52)]],
    ["Atún en aceite de oliva (lata, escurrido)", [195, 25, 0, 10.5], { satFat: 1.8, salt: 0.9 }, [u("1 lata pequeña", 52)]],
    ["Sardinas en aceite (lata, escurridas)", [201, 24.6, 0, 11.5], { satFat: 1.5, salt: 0.8 }, [u("1 lata", 85)]],
    ["Bacalao fresco", [82, 17.8, 0, 0.7], { satFat: 0.1, salt: 0.2 }, [u("1 lomo", 150)]],
    ["Dorada", [115, 19.8, 0, 3.8], { satFat: 1, salt: 0.2 }, [u("1 dorada (limpia)", 250)]],
    ["Lubina", [97, 18.4, 0, 2], { satFat: 0.5, salt: 0.2 }, [u("1 lubina (limpia)", 250)]],
    ["Gambas / langostinos", [85, 20.1, 0, 0.5], { satFat: 0.1, salt: 0.5 }],
    ["Calamar", [92, 15.6, 3.1, 1.4], { satFat: 0.4, salt: 0.1 }],
    ["Mejillones", [86, 11.9, 3.7, 2.2], { satFat: 0.4, salt: 0.7 }],
    ["Surimi (palitos)", [98, 7.6, 15, 0.9], { sugar: 5, salt: 1.9 }, [u("1 palito", 15)]],
  ],
  Lácteos: [
    ["Leche entera", [64, 3.1, 4.7, 3.6], { sugar: 4.7, satFat: 2.4, salt: 0.1 }, [u("1 vaso (250 ml)", 250)]],
    ["Leche semidesnatada", [46, 3.2, 4.8, 1.6], { sugar: 4.8, satFat: 1, salt: 0.1 }, [u("1 vaso (250 ml)", 250)]],
    ["Leche desnatada", [35, 3.3, 4.8, 0.3], { sugar: 4.8, satFat: 0.2, salt: 0.1 }, [u("1 vaso (250 ml)", 250)]],
    ["Yogur natural", [61, 3.5, 4.7, 3.2], { sugar: 4.7, satFat: 2.1, salt: 0.1 }, [u("1 yogur", 125)]],
    ["Yogur natural desnatado", [40, 4.3, 5.6, 0.1], { sugar: 5.6, salt: 0.1 }, [u("1 yogur", 125)]],
    ["Yogur griego natural", [120, 3.5, 4, 10], { sugar: 4, satFat: 6.5, salt: 0.1 }, [u("1 yogur", 125)]],
    ["Skyr natural", [62, 11, 4, 0.2], { sugar: 4, satFat: 0.1, salt: 0.1 }, [u("1 tarrina", 150)]],
    ["Queso fresco batido 0 %", [47, 8, 3.5, 0.1], { sugar: 3.5, salt: 0.1 }, [u("1 cucharada", 30)]],
    ["Queso fresco (tipo Burgos)", [177, 12.4, 2.5, 13], { sugar: 2.5, satFat: 8.5, salt: 1 }, [u("1 tarrina", 250), u("1 porción", 60)]],
    ["Requesón", [96, 11, 3.5, 4], { sugar: 3.5, satFat: 2.6, salt: 0.5 }],
    ["Queso semicurado", [366, 24, 0.5, 30], { satFat: 19, salt: 1.6 }, [u("1 loncha", 20)]],
    ["Queso curado", [412, 26, 0.5, 34], { satFat: 22, salt: 1.8 }, [u("1 cuña", 30)]],
    ["Mozzarella", [247, 18, 1, 19], { satFat: 12.5, salt: 0.5 }, [u("1 bola", 125)]],
    ["Queso parmesano", [388, 35.8, 3.2, 25.8], { satFat: 16.4, salt: 1.6 }, [u("1 cucharada rallado", 5)]],
    ["Kéfir", [52, 3.4, 4, 2.5], { sugar: 4, satFat: 1.6, salt: 0.1 }, [u("1 vaso", 200)]],
    ["Bebida de avena", [46, 0.6, 7.5, 1.5], { fiber: 0.8, sugar: 4, satFat: 0.2, salt: 0.1 }, [u("1 vaso (250 ml)", 250)]],
    ["Bebida de soja", [39, 3.3, 2.5, 1.8], { fiber: 0.6, sugar: 2.5, satFat: 0.3, salt: 0.1 }, [u("1 vaso (250 ml)", 250)]],
  ],
  "Aceites y frutos secos": [
    ["Aceite de oliva", [900, 0, 0, 100], { satFat: 14 }, [u("1 cucharada", 12), u("1 cucharadita", 4)]],
    ["Aceite de girasol", [900, 0, 0, 100], { satFat: 10 }, [u("1 cucharada", 12), u("1 cucharadita", 4)]],
    ["Mantequilla", [717, 0.9, 0.1, 81], { satFat: 51, salt: 0.6 }, [u("1 porción individual", 10)]],
    ["Mayonesa", [685, 1.1, 1.5, 75], { sugar: 1, satFat: 6, salt: 1.5 }, [u("1 cucharada", 15)]],
    ["Aceitunas verdes", [145, 1, 0.5, 15.3], { fiber: 3.3, satFat: 2, salt: 3.9 }, [u("1 aceituna", 4)]],
    ["Almendras", [579, 21.2, 9.1, 49.9], { fiber: 12.5, sugar: 4.4, satFat: 3.8 }, [u("1 puñado", 25)]],
    ["Nueces", [654, 15.2, 7, 65.2], { fiber: 6.7, sugar: 2.6, satFat: 6.1 }, [u("1 nuez (pelada)", 5), u("1 puñado", 25)]],
    ["Cacahuetes", [567, 25.8, 7.6, 49.2], { fiber: 8.5, sugar: 4.7, satFat: 6.3 }, [u("1 puñado", 25)]],
    ["Anacardos", [553, 18.2, 26.9, 43.8], { fiber: 3.3, sugar: 5.9, satFat: 7.8 }, [u("1 puñado", 25)]],
    ["Pistachos (pelados)", [560, 20.2, 16.6, 45.3], { fiber: 10.6, sugar: 7.7, satFat: 5.9 }, [u("1 puñado", 25)]],
    ["Crema de cacahuete", [588, 25, 14, 50], { fiber: 6, sugar: 6, satFat: 10 }, [u("1 cucharada", 15)]],
    ["Pipas de girasol (peladas)", [584, 20.8, 11.4, 51.5], { fiber: 8.6, sugar: 2.6, satFat: 4.5 }, [u("1 puñado", 25)]],
    ["Semillas de chía", [486, 16.5, 7.7, 30.7], { fiber: 34.4, satFat: 3.3 }, [u("1 cucharada", 12)]],
  ],
  Otros: [
    ["Azúcar", [400, 0, 100, 0], { sugar: 100 }, [u("1 cucharadita", 5), u("1 sobre", 8)]],
    ["Miel", [304, 0.3, 82.4, 0], { sugar: 82 }, [u("1 cucharada", 20)]],
    ["Chocolate negro 70 %", [570, 9, 33, 42], { fiber: 11, sugar: 28, satFat: 25 }, [u("1 onza", 10)]],
    ["Ketchup", [105, 1.2, 25, 0.1], { sugar: 22, salt: 1.8 }, [u("1 cucharada", 15)]],
    ["Proteína whey (polvo)", [390, 78, 6, 6], { sugar: 4, satFat: 3.5, salt: 0.5 }, [u("1 cacito", 30)]],
    ["Zumo de naranja", [45, 0.7, 10.4, 0.2], { fiber: 0.2, sugar: 8.4 }, [u("1 vaso (200 ml)", 200)]],
    ["Gazpacho", [46, 0.8, 4, 3], { fiber: 0.8, sugar: 3.5, satFat: 0.4, salt: 0.7 }, [u("1 vaso (250 ml)", 250)]],
    ["Tortilla de patatas (casera)", [172, 6.5, 13, 10.5], { fiber: 1, satFat: 1.8, salt: 0.6 }, [u("1 pincho", 100), u("1 ración", 150)]],
    ["Patatas fritas (bolsa)", [532, 6.5, 50, 34], { fiber: 4, sugar: 0.5, satFat: 3.5, salt: 1.3 }, [u("1 bolsa pequeña", 40)]],
    ["Cerveza", [43, 0.5, 3.6, 0], { sugar: 0.1 }, [u("1 caña", 200), u("1 tercio", 330), u("1 lata", 330)]],
    ["Vino tinto", [85, 0.1, 2.6, 0], { sugar: 0.6 }, [u("1 copa", 150)]],
  ],
};

export const BASIC_CATEGORIES = Object.keys(DATA) as BasicCategory[];

const slug = (s: string) =>
  normalizeText(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Categoría de cada básico (para la pestaña Básicos). */
export const BASIC_CATEGORY = new Map<string, BasicCategory>();

export const BASIC_FOODS: Food[] = BASIC_CATEGORIES.flatMap((category) =>
  DATA[category].map(([name, [kcal, protein, carbs, fat], micro, servings, id]) => {
    const food: Food = { id: BASIC_PREFIX + (id ?? slug(name)), name, per100g: { kcal, protein, carbs, fat, ...micro }, source: "basic" };
    if (servings) food.servings = servings;
    BASIC_CATEGORY.set(food.id, category);
    return food;
  }),
);

/**
 * Une el almacén con los básicos: una corrección del usuario (`edited`) sustituye al básico; una copia sin corregir
 * (guardada al marcarlo como favorito) se ignora, para que mande siempre la versión actual de la app.
 */
export function withBasics(stored: Food[]): Food[] {
  const edited = new Map(stored.filter((f) => f.source === "basic" && f.edited).map((f) => [f.id, f]));
  return [...stored.filter((f) => f.source !== "basic"), ...BASIC_FOODS.map((b) => edited.get(b.id) ?? b)];
}
