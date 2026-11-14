import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateFoodLogRequest, UpdateFoodLogRequest } from "@fitness-app/shared";
import { DatabaseService } from "../database/database.service.js";
import { FoodService, type FoodNutrientSummary } from "../food/food.service.js";

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
}

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

@Injectable()
export class FoodLogService {
  constructor(
    private readonly db: DatabaseService,
    private readonly food: FoodService,
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

    const indbCodes = [...new Set(result.rows.filter((row) => row.food_source === "indb").map((row) => row.food_ref))];
    const summaryByCode = await this.food.getNutrientSummaries(indbCodes);

    return result.rows.map((row) => {
      const summary = row.food_source === "indb" ? summaryByCode.get(row.food_ref) : undefined;
      if (!summary) {
        return { ...row, macros: null };
      }
      const grams = resolveGrams(Number(row.quantity), row.unit, summary.servingGramsByName);
      return { ...row, macros: computeMacros(grams, summary) };
    });
  }

  async update(accountId: string, id: string, patch: UpdateFoodLogRequest): Promise<FoodLogRow> {
    const existing = await this.findOwned(accountId, id);
    const result = await this.db.query<FoodLogRow>(
      `UPDATE app.food_log SET
         quantity = $3, unit = $4, meal_type = $5, logged_at = $6, updated_at = now()
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
      "UPDATE app.food_log SET is_deleted = true, updated_at = now() WHERE id = $1 AND account_id = $2",
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
