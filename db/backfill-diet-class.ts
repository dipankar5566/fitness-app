/**
 * One-off, re-runnable backfill for app.food_diet_class (0005_food_diet_class.sql), classifying
 * every public.food row with the heuristic in packages/shared/src/diet.ts. For a recipe, the
 * classifier sees its own name/aliases plus every recipe_ingredient line (the free-text ingredient
 * name as written, plus the linked ingredient food's own name when recipe_ingredient.ingredient_food_id
 * is set) - that's what lets "Chicken biryani" classify correctly even when the dish name alone
 * doesn't carry every signal. Safe to re-run: always an UPSERT, never additive.
 *
 * Usage: DATABASE_URL=postgresql://user:pass@host:port/db pnpm backfill:diet
 */
import { classifyFood } from "@fitness-app/shared";
import { Client } from "pg";

interface FoodRow {
  id: number;
  code: string;
  name: string;
  food_type: string;
}

interface FoodNameRow {
  food_id: number;
  name: string;
}

interface RecipeIngredientRow {
  recipe_food_id: number;
  ingredient_name: string;
  ingredient_food_id: number | null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const foods = (await client.query<FoodRow>("SELECT id, code, name, food_type FROM food")).rows;
    const nameById = new Map(foods.map((food) => [food.id, food.name]));

    const aliasesByFoodId = new Map<number, string[]>();
    for (const row of (await client.query<FoodNameRow>("SELECT food_id, name FROM food_name")).rows) {
      const list = aliasesByFoodId.get(row.food_id) ?? [];
      list.push(row.name);
      aliasesByFoodId.set(row.food_id, list);
    }

    const ingredientTextsByRecipeId = new Map<number, string[]>();
    const hasIngredientDataByRecipeId = new Set<number>();
    for (const row of (
      await client.query<RecipeIngredientRow>(
        "SELECT recipe_food_id, ingredient_name, ingredient_food_id FROM recipe_ingredient",
      )
    ).rows) {
      hasIngredientDataByRecipeId.add(row.recipe_food_id);
      const texts = ingredientTextsByRecipeId.get(row.recipe_food_id) ?? [];
      texts.push(row.ingredient_name);
      if (row.ingredient_food_id !== null) {
        const linkedName = nameById.get(row.ingredient_food_id);
        if (linkedName) {
          texts.push(linkedName);
        }
      }
      ingredientTextsByRecipeId.set(row.recipe_food_id, texts);
    }

    let classified = 0;
    for (const food of foods) {
      const isRecipe = food.food_type === "recipe";
      const texts = [
        food.name,
        ...(aliasesByFoodId.get(food.id) ?? []),
        ...(isRecipe ? ingredientTextsByRecipeId.get(food.id) ?? [] : []),
      ];
      const result = classifyFood(texts, {
        isRecipe,
        hasIngredientData: isRecipe && hasIngredientDataByRecipeId.has(food.id),
      });

      await client.query(
        `INSERT INTO app.food_diet_class (food_code, diet_class, jain_ok, method, classified_at)
         VALUES ($1, $2, $3, 'heuristic_v1', now())
         ON CONFLICT (food_code) DO UPDATE SET
           diet_class = EXCLUDED.diet_class, jain_ok = EXCLUDED.jain_ok,
           method = EXCLUDED.method, classified_at = EXCLUDED.classified_at`,
        [food.code, result.dietClass, result.jainOk],
      );
      classified += 1;
    }

    console.log(`classified ${classified} foods.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
