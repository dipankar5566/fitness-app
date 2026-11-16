import type { DietType } from "./schemas.ts";

export const DIET_CLASSES = ["vegan", "veg", "egg", "non_veg"] as const;
export type DietClass = (typeof DIET_CLASSES)[number];

export interface FoodDietClass {
  dietClass: DietClass | null;
  jainOk: boolean | null;
}

const NON_VEG_WORDS = [
  "chicken", "mutton", "lamb", "goat", "beef", "pork", "fish", "prawn", "prawns", "shrimp",
  "crab", "turkey", "duck", "bacon", "ham", "sausage", "meat", "seafood", "salmon", "tuna",
  "anchovy", "squid", "octopus", "lobster",
];
const EGG_WORDS = ["egg", "eggs"];
const EGG_EXCEPTIONS = ["eggplant", "egg plant", "eggfruit"];
const DAIRY_WORDS = ["milk", "paneer", "curd", "yogurt", "yoghurt", "ghee", "butter", "cheese", "cream", "khoya", "mawa"];
const DAIRY_EXCEPTIONS = [
  "coconut milk", "almond milk", "soy milk", "soya milk", "oat milk", "cashew milk",
  "butter bean", "butter beans", "butter fruit",
];
const JAIN_FORBIDDEN_WORDS = ["onion", "garlic", "potato", "carrot", "radish", "beetroot", "beet root"];

function containsWord(text: string, words: string[]): boolean {
  return words.some((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
}

/** Removes exception phrases before word-matching, so "eggplant curry" doesn't match "egg" and
 * "coconut milk biryani" doesn't match "milk". */
function stripExceptions(text: string, exceptions: string[]): string {
  let stripped = text.toLowerCase();
  for (const phrase of exceptions) {
    stripped = stripped.split(phrase).join(" ");
  }
  return stripped;
}

export interface ClassifyFoodOptions {
  isRecipe: boolean;
  /** True if at least one recipe_ingredient row was found for this recipe (ignored for a plain
   * ingredient). Lets a recipe with no ingredient data and no keyword hit in its own name come
   * back unclassified, instead of guessing "vegan" from nothing. */
  hasIngredientData: boolean;
}

/**
 * Heuristic diet classifier (v1) - keyword matching over a food's name(s), aliases, and (for a
 * recipe) its ingredient lines. Not a nutrition/allergen authority: when there's no real signal,
 * it returns `dietClass: null` rather than guess - the app shows those foods tagged "unverified"
 * instead of hiding them.
 */
export function classifyFood(texts: string[], options: ClassifyFoodOptions): FoodDietClass {
  const strippedForEgg = texts.map((text) => stripExceptions(text, EGG_EXCEPTIONS));
  const strippedForDairy = texts.map((text) => stripExceptions(text, DAIRY_EXCEPTIONS));

  const hasNonVeg = texts.some((text) => containsWord(text, NON_VEG_WORDS));
  const hasEgg = strippedForEgg.some((text) => containsWord(text, EGG_WORDS));
  const hasDairy = strippedForDairy.some((text) => containsWord(text, DAIRY_WORDS));
  const hasJainForbidden = texts.some((text) => containsWord(text, JAIN_FORBIDDEN_WORDS));

  let dietClass: DietClass | null;
  if (hasNonVeg) {
    dietClass = "non_veg";
  } else if (hasEgg) {
    dietClass = "egg";
  } else if (hasDairy) {
    dietClass = "veg";
  } else if (!options.isRecipe || options.hasIngredientData) {
    // A plain ingredient, or a recipe whose every ingredient line was checked, with no animal
    // keyword found anywhere - vegan.
    dietClass = "vegan";
  } else {
    // A recipe with no ingredient data and no keyword hit in its own name - don't guess.
    dietClass = null;
  }

  return { dietClass, jainOk: hasJainForbidden ? false : null };
}

const ALLOWED_DIET_CLASSES: Record<DietType, DietClass[]> = {
  vegan: ["vegan"],
  veg: ["vegan", "veg"],
  jain: ["vegan", "veg"],
  eggetarian: ["vegan", "veg", "egg"],
  non_veg: ["vegan", "veg", "egg", "non_veg"],
};

export function allowedDietClasses(dietType: DietType): DietClass[] {
  return ALLOWED_DIET_CLASSES[dietType];
}

/** Whether a food is allowed for a user's diet type. A null dietClass is always allowed - it
 * means "unverified", not "excluded" (see classifyFood's docstring). */
export function isAllowed(dietType: DietType, dietClass: DietClass | null, jainOk: boolean | null): boolean {
  if (dietClass === null) {
    return true;
  }
  if (!allowedDietClasses(dietType).includes(dietClass)) {
    return false;
  }
  if (dietType === "jain" && jainOk === false) {
    return false;
  }
  return true;
}
