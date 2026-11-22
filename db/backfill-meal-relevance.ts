/**
 * Re-runnable backfill for app.food_meal_relevance (0007_food_meal_relevance.sql). For every indb
 * food it blends how often that food has been logged at each meal (observed counts from
 * app.food_log) with a cold-start prior derived from the food's name, via packages/shared's pure
 * scoreMealRelevance/mealPriorForName. Writes four rows per food (one per meal), the four scores
 * summing to 1. Our own heuristic ("relevance_v1"); nothing is taken from any third-party food DB.
 *
 * Run it after new logs accumulate to refresh the observed component; with no logs yet, every
 * food's score is simply its name prior, which is enough to seed useful suggestions. Safe to
 * re-run: always an UPSERT on (food_code, meal_type).
 *
 * Usage: DATABASE_URL=postgresql://user:pass@host:port/db pnpm backfill:relevance
 */
import { MEAL_TYPES, mealPriorForName, scoreMealRelevance } from "@fitness-app/shared";
import type { MealRelevanceCounts } from "@fitness-app/shared";
import { Client } from "pg";

const METHOD = "relevance_v1";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const foods = (await client.query<{ code: string; name: string }>("SELECT code, name FROM food"))
      .rows;

    // Observed per-meal log counts for indb foods (food_source='indb'), excluding soft-deleted rows.
    const countsByCode = new Map<string, MealRelevanceCounts>();
    const logRows = (
      await client.query<{ food_ref: string; meal_type: string; n: string }>(
        `SELECT food_ref, meal_type, count(*)::text AS n
         FROM app.food_log
         WHERE food_source = 'indb' AND is_deleted = false
         GROUP BY food_ref, meal_type`,
      )
    ).rows;
    for (const row of logRows) {
      const counts = countsByCode.get(row.food_ref) ?? {};
      counts[row.meal_type as keyof MealRelevanceCounts] = Number(row.n);
      countsByCode.set(row.food_ref, counts);
    }

    let written = 0;
    for (const food of foods) {
      const score = scoreMealRelevance(countsByCode.get(food.code) ?? {}, mealPriorForName(food.name));
      for (const meal of MEAL_TYPES) {
        await client.query(
          `INSERT INTO app.food_meal_relevance (food_code, meal_type, score, method, computed_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (food_code, meal_type) DO UPDATE SET
             score = EXCLUDED.score, method = EXCLUDED.method, computed_at = EXCLUDED.computed_at`,
          [food.code, meal, score[meal], METHOD],
        );
        written += 1;
      }
    }

    console.log(`wrote ${written} relevance rows for ${foods.length} foods.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
