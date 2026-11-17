import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateFoodLogRequest, UpdateFoodLogRequest } from "@fitness-app/shared";
import { DatabaseService } from "../database/database.service.js";
import { FoodService, type FoodNutrientSummary } from "../food/food.service.js";
import { PackagedFoodService } from "../packaged-food/packaged-food.service.js";

interface FoodLogRow {
  id: string;
  account_id: string;
  food_source: string;
  food_ref: string;
  quantity: string;
  unit: string;
  meal_type: string;
  logged_at: Date;
  source: string;
  is_estimate: boolean;
  is_deleted: boolean;
  updated_at: Date;
}

export interface MacroBreakdown {
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
}

export interface FoodLogEntryWithMacros extends FoodLogRow {
  macros: MacroBreakdown | null;
  /** The food's display name, resolved fresh from food_source/food_ref every time (never stored
   * on app.food_log itself) - apps/mobile snapshots this locally as food_log.food_name so the
   * Today diary can show it without a lookup. Null if the referenced food/custom_food/
   * packaged_food can't be resolved (e.g. deleted server-side). */
  food_name: string | null;
}

export type { FoodLogRow };

function resolveGrams(
  quantity: number,
  unit: string,
  servingGramsByName: Record<string, number>,
): number | null {
  if (unit === "g" || unit === "ml") {
    return quantity;
  }
  const gramsPerUnit = servingGramsByName[unit];
  return gramsPerUnit === undefined ? null : quantity * gramsPerUnit;
}

function computeMacros(grams: number | null, summary: FoodNutrientSummary): MacroBreakdown | null {
  if (grams === null) {
    return null;
  }
  const scale = grams / 100;
  const scaleOrNull = (per100g: number | null) =>
    per100g === null ? null : Math.round(per100g * scale * 10) / 10;
  return {
    kcal: scaleOrNull(summary.kcalPer100g),
    proteinG: scaleOrNull(summary.proteinGPer100g),
    fatG: scaleOrNull(summary.fatGPer100g),
    carbG: scaleOrNull(summary.carbGPer100g),
  };
}

interface CustomFoodIngredientRow {
  custom_food_id: string;
  food_source: string;
  food_ref: string;
  quantity_g: string;
}

/** Per-gram-of-whole-recipe macros for each custom_food id that has at least one indb-sourced
 * ingredient with known nutrients. Nested custom/packaged sub-ingredients don't contribute (v1
 * limitation - same spirit as packaged-food/OFF integration being its own later milestone). */
async function computeCustomFoodMacrosPerGram(
  customFoodIds: string[],
  food: FoodService,
  db: DatabaseService,
): Promise<Map<string, MacroBreakdown>> {
  const perGramById = new Map<string, MacroBreakdown>();
  if (customFoodIds.length === 0) {
    return perGramById;
  }

  const ingredients = await db.query<CustomFoodIngredientRow>(
    `SELECT custom_food_id, food_source, food_ref, quantity_g FROM app.custom_food_ingredient
     WHERE custom_food_id = ANY($1) AND is_deleted = false`,
    [customFoodIds],
  );

  const indbRefs = [
    ...new Set(ingredients.rows.filter((row) => row.food_source === "indb").map((row) => row.food_ref)),
  ];
  const summaryByCode = await food.getNutrientSummaries(indbRefs);

  const byCustomFoodId = new Map<string, CustomFoodIngredientRow[]>();
  for (const ingredient of ingredients.rows) {
    const list = byCustomFoodId.get(ingredient.custom_food_id) ?? [];
    list.push(ingredient);
    byCustomFoodId.set(ingredient.custom_food_id, list);
  }

  for (const [customFoodId, recipeIngredients] of byCustomFoodId) {
    let totalGrams = 0;
    let kcal = 0;
    let proteinG = 0;
    let fatG = 0;
    let carbG = 0;
    let hasKnownIngredient = false;

    for (const ingredient of recipeIngredients) {
      const grams = Number(ingredient.quantity_g);
      totalGrams += grams;
      const summary = ingredient.food_source === "indb" ? summaryByCode.get(ingredient.food_ref) : undefined;
      if (!summary) {
        continue;
      }
      hasKnownIngredient = true;
      const scale = grams / 100;
      kcal += (summary.kcalPer100g ?? 0) * scale;
      proteinG += (summary.proteinGPer100g ?? 0) * scale;
      fatG += (summary.fatGPer100g ?? 0) * scale;
      carbG += (summary.carbGPer100g ?? 0) * scale;
    }

    if (hasKnownIngredient && totalGrams > 0) {
      perGramById.set(customFoodId, {
        kcal: kcal / totalGrams,
        proteinG: proteinG / totalGrams,
        fatG: fatG / totalGrams,
        carbG: carbG / totalGrams,
      });
    }
  }

  return perGramById;
}

/** Enriches raw food_log rows with real macros for indb-sourced rows (ARCHITECTURE.md §2),
 * custom-food rows (sum of each recipe's indb-sourced ingredients, scaled by grams logged), and
 * packaged-food rows (Open Food Facts, PRD §5.5). Pulled out of `listByDate` so the sync pull path
 * (which also returns food_log rows) can reuse it. */
export async function enrichWithMacros(
  rows: FoodLogRow[],
  food: FoodService,
  db: DatabaseService,
  packagedFood: PackagedFoodService,
): Promise<FoodLogEntryWithMacros[]> {
  const indbCodes = [...new Set(rows.filter((row) => row.food_source === "indb").map((row) => row.food_ref))];
  const customFoodIds = [...new Set(rows.filter((row) => row.food_source === "custom").map((row) => row.food_ref))];
  const packagedFoodIds = [
    ...new Set(rows.filter((row) => row.food_source === "packaged").map((row) => row.food_ref)),
  ];

  const summaryByCode = await food.getNutrientSummaries(indbCodes);
  const perGramByCustomFoodId = await computeCustomFoodMacrosPerGram(customFoodIds, food, db);
  const summaryByPackagedFoodId = await packagedFood.getNutrientSummaries(packagedFoodIds);
  const customFoodNameById = await getCustomFoodNames(customFoodIds, db);

  return rows.map((row) => {
    if (row.food_source === "indb") {
      const summary = summaryByCode.get(row.food_ref);
      if (!summary) {
        return { ...row, macros: null, food_name: null };
      }
      const grams = resolveGrams(Number(row.quantity), row.unit, summary.servingGramsByName);
      return { ...row, macros: computeMacros(grams, summary), food_name: summary.name };
    }

    if (row.food_source === "custom") {
      const perGram = perGramByCustomFoodId.get(row.food_ref);
      const food_name = customFoodNameById.get(row.food_ref) ?? null;
      if (!perGram) {
        return { ...row, macros: null, food_name };
      }
      const gramsLogged = Number(row.quantity); // custom foods: quantity is always grams of the recipe
      const scaled = (perGramValue: number | null) =>
        perGramValue === null ? null : Math.round(perGramValue * gramsLogged * 10) / 10;
      return {
        ...row,
        macros: {
          kcal: scaled(perGram.kcal),
          proteinG: scaled(perGram.proteinG),
          fatG: scaled(perGram.fatG),
          carbG: scaled(perGram.carbG),
        },
        food_name,
      };
    }

    if (row.food_source === "packaged") {
      const perHundredGrams = summaryByPackagedFoodId.get(row.food_ref);
      if (!perHundredGrams) {
        return { ...row, macros: null, food_name: null };
      }
      const gramsLogged = Number(row.quantity); // packaged foods: quantity is always grams, same v1 simplification as custom foods
      const scale = gramsLogged / 100;
      const scaled = (per100g: number | null) => (per100g === null ? null : Math.round(per100g * scale * 10) / 10);
      return {
        ...row,
        macros: {
          kcal: scaled(perHundredGrams.kcal),
          proteinG: scaled(perHundredGrams.proteinG),
          fatG: scaled(perHundredGrams.fatG),
          carbG: scaled(perHundredGrams.carbG),
        },
        food_name: perHundredGrams.brand ? `${perHundredGrams.name} (${perHundredGrams.brand})` : perHundredGrams.name,
      };
    }

    return { ...row, macros: null, food_name: null };
  });
}

/** Batched name lookup for custom_food rows, mirroring the batch-everything-up-front style
 * computeCustomFoodMacrosPerGram already uses - one query for however many distinct custom foods
 * appear in this call's rows, not one per row. */
async function getCustomFoodNames(customFoodIds: string[], db: DatabaseService): Promise<Map<string, string>> {
  if (customFoodIds.length === 0) {
    return new Map();
  }
  const result = await db.query<{ id: string; name: string }>(
    "SELECT id, name FROM app.custom_food WHERE id = ANY($1)",
    [customFoodIds],
  );
  return new Map(result.rows.map((row) => [row.id, row.name]));
}

@Injectable()
export class FoodLogService {
  constructor(
    private readonly db: DatabaseService,
    private readonly food: FoodService,
    private readonly packagedFood: PackagedFoodService,
  ) {}

  async create(accountId: string, input: CreateFoodLogRequest): Promise<FoodLogRow> {
    const result = await this.db.query<FoodLogRow>(
      `INSERT INTO app.food_log (id, account_id, food_source, food_ref, quantity, unit, meal_type, logged_at, source, is_estimate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.id,
        accountId,
        input.foodSource,
        input.foodRef,
        input.quantity,
        input.unit,
        input.mealType,
        input.loggedAt,
        input.source,
        input.isEstimate ?? false,
      ],
    );
    return result.rows[0];
  }

  /** One UTC day's entries, enriched with real macros for indb-sourced rows (ARCHITECTURE.md §2). */
  async listByDate(accountId: string, date: string): Promise<FoodLogEntryWithMacros[]> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const result = await this.db.query<FoodLogRow>(
      `SELECT * FROM app.food_log
       WHERE account_id = $1 AND logged_at >= $2 AND logged_at < $3 AND is_deleted = false
       ORDER BY logged_at`,
      [accountId, start, end],
    );

    return enrichWithMacros(result.rows, this.food, this.db, this.packagedFood);
  }

  async update(accountId: string, id: string, patch: UpdateFoodLogRequest): Promise<FoodLogRow> {
    const existing = await this.findOwned(accountId, id);
    const result = await this.db.query<FoodLogRow>(
      `UPDATE app.food_log SET
         quantity = $3, unit = $4, meal_type = $5, logged_at = $6, updated_at = now(), server_updated_at = now()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [
        id,
        accountId,
        patch.quantity ?? existing.quantity,
        patch.unit ?? existing.unit,
        patch.mealType ?? existing.meal_type,
        patch.loggedAt ?? existing.logged_at,
      ],
    );
    return result.rows[0];
  }

  async softDelete(accountId: string, id: string): Promise<void> {
    await this.findOwned(accountId, id);
    await this.db.query(
      "UPDATE app.food_log SET is_deleted = true, updated_at = now(), server_updated_at = now() WHERE id = $1 AND account_id = $2",
      [id, accountId],
    );
  }

  private async findOwned(accountId: string, id: string): Promise<FoodLogRow> {
    const result = await this.db.query<FoodLogRow>(
      "SELECT * FROM app.food_log WHERE id = $1 AND is_deleted = false",
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`No food_log entry with id '${id}'`);
    }
    if (row.account_id !== accountId) {
      throw new ForbiddenException("Not your food_log entry");
    }
    return row;
  }
}
