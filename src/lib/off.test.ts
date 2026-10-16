import { describe, expect, it } from "vitest";
import { offName, toFood } from "./off";

describe("toFood (Open Food Facts)", () => {
  it("extrae macros, micros y raciones", () => {
    const f = toFood({
      code: "8410000000001",
      product_name_es: "Yogur natural",
      brands: "Marca, Otra",
      serving_size: "125 g",
      serving_quantity: 125,
      product_quantity: 500,
      nutriments: {
        "energy-kcal_100g": 61,
        proteins_100g: 3.5,
        carbohydrates_100g: 4.7,
        fat_100g: 3.2,
        fiber_100g: 0,
        sugars_100g: "4.7",
        "saturated-fat_100g": 2.1,
        sodium_100g: 0.04,
      },
    })!;
    expect(f.id).toBe("off:8410000000001");
    expect(f.brand).toBe("Marca");
    expect(f.source).toBe("off");
    expect(f.per100g).toEqual({ kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.2, fiber: 0, sugar: 4.7, satFat: 2.1, salt: 0.1 });
    expect(f.servings).toEqual([
      { label: "ración 125 g", grams: 125 },
      { label: "envase", grams: 500 },
    ]);
  });

  it("kcal desde kJ si falta y descarta productos sin datos", () => {
    expect(toFood({ product_name: "X", nutriments: { energy_100g: 418.4 } })!.per100g.kcal).toBe(100);
    expect(toFood({ product_name: "Vacío", nutriments: {} })).toBeNull();
    expect(toFood({ nutriments: { proteins_100g: 3 } })).toBeNull();
  });

  it("sin nombre en español usa el de otro idioma (marcas de Lidl)", () => {
    const f = toFood({
      code: "4056489996835",
      product_name: "",
      product_name_es: "",
      product_name_en: "High Protein Pudding Sabor Chocolate",
      product_name_it: "High Protein Budino",
      brands: "LIDL",
      nutriments: { "energy-kcal_100g": 83, proteins_100g: 10.1, carbohydrates_100g: 6.5, fat_100g: 1.5 },
    })!;
    expect(f.name).toBe("High Protein Pudding Sabor Chocolate");
    expect(offName({ product_name: "Principal", product_name_en: "English" })).toBe("Principal");
    expect(offName({ product_name_es: " ", generic_name_es: "Postre lácteo" })).toBe("Postre lácteo");
    expect(toFood({ product_name: "", nutriments: { "energy-kcal_100g": 83 } })).toBeNull();
  });
});
