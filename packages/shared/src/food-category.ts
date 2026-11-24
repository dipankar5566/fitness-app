/**
 * Pure classifier that buckets a food into one of the audit brief's 10 categories, used only by
 * `db/audit-food-data.ts` reporting (not by any app feature). Follows `diet.ts`'s approach: reads
 * the food's name(s) plus, for a recipe, its ingredient lines - never guesses from nothing.
 */

export const FOOD_CATEGORIES = [
  "raw_ingredient",
  "cooked_ingredient",
  "composite_indian_recipe",
  "international_recipe",
  "packaged_branded",
  "restaurant",
  "fruit_vegetable",
  "dairy",
  "meat_poultry_fish",
  "snack_beverage",
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

const COOKED_STATE_WORDS = [
  "boiled", "steamed", "fried", "roasted", "grilled", "baked", "cooked", "poached",
  "sauteed", "sautéed", "stewed", "braised", "blanched", "parboiled", "pressure cooked",
];
const FRUIT_VEG_WORDS = [
  "banana", "apple", "orange", "mango", "papaya", "guava", "watermelon", "grape", "pomegranate",
  "potato", "tomato", "onion", "spinach", "cauliflower", "cabbage", "carrot", "cucumber",
  "brinjal", "eggplant", "pea", "beans", "gourd", "pumpkin", "radish", "beetroot",
];
const DAIRY_WORDS = ["milk", "curd", "yogurt", "yoghurt", "paneer", "cheese", "butter", "ghee", "khoya", "mawa", "cream"];
const MEAT_WORDS = [
  "chicken", "mutton", "lamb", "goat", "beef", "pork", "fish", "rohu", "katla", "pomfret",
  "prawn", "shrimp", "crab", "egg",
];
const SNACK_BEVERAGE_WORDS = [
  "chips", "namkeen", "biscuit", "cookie", "cake", "chocolate", "soda", "juice", "shake",
  "milkshake", "coffee", "tea", "lassi", "soft drink", "cola",
];
const INTERNATIONAL_WORDS = [
  "pasta", "pizza", "burger", "sandwich", "lasagne", "lasagna", "noodle", "chowmein",
  "manchurian", "souffle", "soufflé", "salad", "soup", "stew", "casserole",
];

function containsAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

export interface FoodCategoryInput {
  isRecipe: boolean;
  /** Primary + alias names. */
  names: string[];
  /** For a recipe: the free-text ingredient lines (recipe_ingredient.ingredient_name) plus any
   * linked ingredient's own name. Empty for a plain ingredient. */
  ingredientTexts: string[];
  /** app.packaged_food lookup result, if already known - reused rather than reclassified. */
  isPackaged?: boolean;
}

/**
 * Best-effort category for audit reporting only (never used to gate app behaviour). A food that
 * matches no finer-grained word signal falls back to `composite_indian_recipe` (recipe) or
 * `raw_ingredient` (ingredient), since every INDB row is one of those two at minimum - this
 * function only adds a finer category on top when a clear word match exists.
 */
export function classifyFoodCategory(input: FoodCategoryInput): FoodCategory {
  const allText = [...input.names, ...input.ingredientTexts].join(" ");

  if (input.isPackaged) {
    return "packaged_branded";
  }
  if (!input.isRecipe) {
    // Raw-vs-cooked is checked before the finer dairy/meat/fruit-veg buckets: the audit brief's
    // whole point (section 5/6) is that "Potato, boiled" must never collapse into the same
    // bucket as "Potato, raw" just because both are a vegetable.
    if (containsAny(allText, COOKED_STATE_WORDS)) {
      return "cooked_ingredient";
    }
    if (containsAny(allText, DAIRY_WORDS)) {
      return "dairy";
    }
    if (containsAny(allText, MEAT_WORDS)) {
      return "meat_poultry_fish";
    }
    if (containsAny(allText, FRUIT_VEG_WORDS)) {
      return "fruit_vegetable";
    }
    return "raw_ingredient";
  }

  // Recipe.
  if (containsAny(allText, SNACK_BEVERAGE_WORDS)) {
    return "snack_beverage";
  }
  if (containsAny(allText, INTERNATIONAL_WORDS)) {
    return "international_recipe";
  }
  return "composite_indian_recipe";
}
