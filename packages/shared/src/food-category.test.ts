import { describe, expect, it } from "vitest";
import { classifyFoodCategory } from "./food-category.ts";

describe("classifyFoodCategory", () => {
  it("classifies a plain raw ingredient with no cooked-state word as raw", () => {
    expect(
      classifyFoodCategory({ isRecipe: false, names: ["Rice, raw, milled"], ingredientTexts: [] }),
    ).toBe("raw_ingredient");
  });

  it("classifies an ingredient whose name carries a cooked-state word as cooked", () => {
    expect(
      classifyFoodCategory({ isRecipe: false, names: ["Potato, boiled"], ingredientTexts: [] }),
    ).toBe("cooked_ingredient");
  });

  it("prefers dairy over a bare cooked-state match for a dairy ingredient", () => {
    expect(classifyFoodCategory({ isRecipe: false, names: ["Paneer"], ingredientTexts: [] })).toBe("dairy");
  });

  it("classifies a meat/poultry ingredient as meat_poultry_fish", () => {
    expect(
      classifyFoodCategory({ isRecipe: false, names: ["Chicken, poultry, breast, skinless"], ingredientTexts: [] }),
    ).toBe("meat_poultry_fish");
  });

  it("classifies a fruit/vegetable ingredient correctly", () => {
    expect(classifyFoodCategory({ isRecipe: false, names: ["Banana, ripe"], ingredientTexts: [] })).toBe(
      "fruit_vegetable",
    );
  });

  it("falls back to composite_indian_recipe for a recipe with no finer signal", () => {
    expect(
      classifyFoodCategory({ isRecipe: true, names: ["Dal makhani"], ingredientTexts: ["Lentil", "Butter"] }),
    ).toBe("composite_indian_recipe");
  });

  it("classifies a recipe with an international-cuisine word as international", () => {
    expect(
      classifyFoodCategory({ isRecipe: true, names: ["Chicken lasagne"], ingredientTexts: ["Chicken", "Pasta sheet"] }),
    ).toBe("international_recipe");
  });

  it("classifies a snack/beverage recipe correctly even though it also contains dairy", () => {
    expect(
      classifyFoodCategory({ isRecipe: true, names: ["Banana milkshake"], ingredientTexts: ["Banana", "Milk"] }),
    ).toBe("snack_beverage");
  });

  it("classifies a packaged food as packaged_branded regardless of its name", () => {
    expect(
      classifyFoodCategory({
        isRecipe: false,
        names: ["Maggi 2-Minute Noodles"],
        ingredientTexts: [],
        isPackaged: true,
      }),
    ).toBe("packaged_branded");
  });

  it("looks at ingredient lines, not just the recipe's own name, when classifying a recipe", () => {
    // The recipe's own name alone has no international/snack word, but an ingredient line does -
    // classifyFoodCategory has to look at both, matching diet.ts's style.
    expect(
      classifyFoodCategory({ isRecipe: true, names: ["Weekend brunch plate"], ingredientTexts: ["Pizza base", "Cheese"] }),
    ).toBe("international_recipe");
  });
});
