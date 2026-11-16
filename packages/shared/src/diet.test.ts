import { describe, expect, it } from "vitest";
import { allowedDietClasses, classifyFood, isAllowed } from "./diet.ts";

describe("classifyFood", () => {
  it("classifies chicken as non_veg", () => {
    expect(classifyFood(["Chicken curry"], { isRecipe: false, hasIngredientData: false }).dietClass).toBe(
      "non_veg",
    );
  });

  it("classifies fish as non_veg", () => {
    expect(classifyFood(["Fish fry"], { isRecipe: false, hasIngredientData: false }).dietClass).toBe("non_veg");
  });

  it("classifies plain egg as egg, not non_veg", () => {
    expect(classifyFood(["Boiled egg"], { isRecipe: false, hasIngredientData: false }).dietClass).toBe("egg");
  });

  it("does not classify eggplant as egg", () => {
    expect(classifyFood(["Eggplant curry"], { isRecipe: true, hasIngredientData: false }).dietClass).not.toBe(
      "egg",
    );
  });

  it("classifies paneer as veg (dairy), not vegan", () => {
    expect(classifyFood(["Paneer tikka"], { isRecipe: false, hasIngredientData: false }).dietClass).toBe("veg");
  });

  it("classifies plant milks as vegan, not veg", () => {
    expect(classifyFood(["Coconut milk"], { isRecipe: false, hasIngredientData: false }).dietClass).toBe(
      "vegan",
    );
  });

  it("classifies a plain ingredient with no animal keyword as vegan", () => {
    expect(classifyFood(["Basmati rice"], { isRecipe: false, hasIngredientData: false }).dietClass).toBe(
      "vegan",
    );
  });

  it("classifies a recipe from its ingredient lines, not just its own name", () => {
    const result = classifyFood(["Non-veg biryani", "Chicken, broiler, raw"], {
      isRecipe: true,
      hasIngredientData: true,
    });
    expect(result.dietClass).toBe("non_veg");
  });

  it("leaves a recipe with no ingredient data and no keyword hit unclassified", () => {
    const result = classifyFood(["Grandma's special"], { isRecipe: true, hasIngredientData: false });
    expect(result.dietClass).toBeNull();
  });

  it("classifies a recipe with ingredient data but no animal keyword as vegan", () => {
    const result = classifyFood(["Veg biryani", "Rice", "Carrot", "Peas"], {
      isRecipe: true,
      hasIngredientData: true,
    });
    expect(result.dietClass).toBe("vegan");
  });

  it("marks onion as not jain-ok", () => {
    expect(classifyFood(["Onion curry"], { isRecipe: true, hasIngredientData: false }).jainOk).toBe(false);
  });

  it("leaves jainOk null when there's no root-vegetable keyword", () => {
    expect(classifyFood(["Plain dal"], { isRecipe: false, hasIngredientData: false }).jainOk).toBeNull();
  });

  it("marks non-dairy butter beans as not dairy", () => {
    expect(classifyFood(["Butter beans"], { isRecipe: false, hasIngredientData: false }).dietClass).toBe(
      "vegan",
    );
  });
});

describe("allowedDietClasses", () => {
  it("every diet type allows at least vegan foods", () => {
    for (const dietType of ["vegan", "veg", "jain", "eggetarian", "non_veg"] as const) {
      expect(allowedDietClasses(dietType)).toContain("vegan");
    }
  });

  it("is strictly narrower moving from non_veg to vegan (vegan ⊂ veg ⊂ eggetarian ⊂ non_veg)", () => {
    const vegan = new Set(allowedDietClasses("vegan"));
    const veg = new Set(allowedDietClasses("veg"));
    const eggetarian = new Set(allowedDietClasses("eggetarian"));
    const nonVeg = new Set(allowedDietClasses("non_veg"));

    for (const dietClass of vegan) expect(veg.has(dietClass)).toBe(true);
    for (const dietClass of veg) expect(eggetarian.has(dietClass)).toBe(true);
    for (const dietClass of eggetarian) expect(nonVeg.has(dietClass)).toBe(true);

    expect(veg.size).toBeGreaterThan(vegan.size);
    expect(eggetarian.size).toBeGreaterThan(veg.size);
    expect(nonVeg.size).toBeGreaterThan(eggetarian.size);
  });

  it("jain allows the same food classes as veg", () => {
    expect(new Set(allowedDietClasses("jain"))).toEqual(new Set(allowedDietClasses("veg")));
  });
});

describe("isAllowed", () => {
  it("a null dietClass is always allowed (unverified, not excluded)", () => {
    expect(isAllowed("vegan", null, null)).toBe(true);
  });

  it("rejects a non_veg food for a veg user", () => {
    expect(isAllowed("veg", "non_veg", null)).toBe(false);
  });

  it("rejects an egg food for a vegan user but allows it for eggetarian", () => {
    expect(isAllowed("vegan", "egg", null)).toBe(false);
    expect(isAllowed("eggetarian", "egg", null)).toBe(true);
  });

  it("rejects a veg food with jainOk false for a jain user, but allows it for a veg user", () => {
    expect(isAllowed("jain", "veg", false)).toBe(false);
    expect(isAllowed("veg", "veg", false)).toBe(true);
  });

  it("allows everything for a non_veg user", () => {
    for (const dietClass of ["vegan", "veg", "egg", "non_veg"] as const) {
      expect(isAllowed("non_veg", dietClass, false)).toBe(true);
    }
  });
});
