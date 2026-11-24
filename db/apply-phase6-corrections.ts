/**
 * Phase 6 of the food-nutrition audit (docs/FOOD_DATABASE_CORRECTIONS.md) - applies a correction
 * to app.food_nutrition. Unlike every other db/ script in this pass, this one is a deliberate,
 * narrow, hand-reviewed write to production nutrition data - it does NOT generically "apply
 * whatever's in proposed_corrections.csv".
 *
 * Why so narrow: a second review pass (done while building this script) found that the automated
 * water-exclusion correction (docs/FOOD_DATABASE_CORRECTIONS.md's "estimated" tier, 187 recipes)
 * is NOT safely applicable in bulk, even after excluding beverages/soups and flour/dough dishes.
 * The remaining candidate list is dominated by dal, pulao, khichdi, kheer, stock, squash, jam, and
 * pickle recipes - in every one of these, the "water" ingredient is either absorbed into a grain/
 * pulse (same physical reality as dough, just missed by a word-match on "flour"), IS the finished
 * product (stock, squash, a drink), or is a preservation medium (jam/pickle) - never a simple
 * boiled-and-discarded medium the way a boiled egg's water is. Automating "is this water really
 * discarded" correctly for this food database would need real culinary/nutrition-science review
 * per recipe, which the brief's own rules require before a destructive update
 * ("review uncertain mappings... obtain approval before destructive updates") - this script
 * deliberately does NOT attempt that at scale.
 *
 * What IS applied: ASC056 "Boiled egg (Ubla anda)" only, sourced from a real, directly-verified
 * USDA FoodData Central record (not estimated, not recalculated) - FDC 173424, "Egg, whole,
 * cooked, hard-boiled", SR Legacy, CC0: 155 kcal, 12.58g protein, 10.61g fat, 1.12g carb per 100g.
 * This is the one case in this pass with a genuine `verified`-tier source, not this project's own
 * estimate - see docs/NUTRITION_DATA_SOURCES.md's "a matched raw/cooked SR Legacy pair for egg".
 *
 * The other 554 flagged recipes (`docs/FOOD_DATABASE_CORRECTIONS.md`) remain uncorrected,
 * documented, and explicitly flagged for a future pass with real domain review - not silently
 * dropped.
 *
 * Usage: DATABASE_URL=postgresql://user:pass@host:port/db pnpm apply:phase6-corrections [--write]
 */
import { Client } from "pg";

interface Correction {
  foodCode: string;
  kcalPer100g: number;
  proteinGPer100g: number;
  fatGPer100g: number;
  carbGPer100g: number;
  source: string;
  confidence: "verified";
}

const CORRECTIONS: Correction[] = [
  {
    foodCode: "ASC056", // Boiled egg (Ubla anda)
    kcalPer100g: 155,
    proteinGPer100g: 12.58,
    fatGPer100g: 10.61,
    carbGPer100g: 1.12,
    source: "usda_fdc_173424", // "Egg, whole, cooked, hard-boiled", SR Legacy, CC0
    confidence: "verified",
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const write = process.argv.includes("--write");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const correction of CORRECTIONS) {
      const existing = await client.query<{ version: number }>(
        "SELECT version FROM app.food_nutrition WHERE food_code = $1 ORDER BY version DESC LIMIT 1",
        [correction.foodCode],
      );
      const nextVersion = (existing.rows[0]?.version ?? 0) + 1;

      const current = await client.query<{ code: string; name: string; kcal: string | null }>(
        `SELECT f.code, f.name, fn.per_100g AS kcal
         FROM food f LEFT JOIN food_nutrient fn ON fn.food_id = f.id
           AND fn.nutrient_id = (SELECT id FROM nutrient WHERE code = 'energy_kcal')
         WHERE f.code = $1`,
        [correction.foodCode],
      );
      const before = current.rows[0];
      console.log(
        `${correction.foodCode} (${before?.name}): current ${before?.kcal ?? "null"} kcal/100g -> proposed ${correction.kcalPer100g} kcal/100g (version ${nextVersion}, source ${correction.source})`,
      );

      if (!write) continue;

      await client.query(
        `INSERT INTO app.food_nutrition
           (food_code, version, kcal_per_100g, protein_g_per_100g, fat_g_per_100g, carb_g_per_100g, source, source_record_id, confidence, last_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
        [
          correction.foodCode,
          nextVersion,
          correction.kcalPer100g,
          correction.proteinGPer100g,
          correction.fatGPer100g,
          correction.carbGPer100g,
          "usda_fdc",
          correction.source,
          correction.confidence,
        ],
      );
      console.log(`  -> inserted app.food_nutrition version ${nextVersion}`);
    }

    if (!write) {
      console.log("\nDry run (pass --write to apply). public.food_nutrient was never touched - it stays read-only.");
    } else {
      console.log(`\nApplied ${CORRECTIONS.length} correction(s) to app.food_nutrition. public.food_nutrient is unchanged (read-only).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
