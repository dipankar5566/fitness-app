import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

export interface PackagedFoodNutrients {
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  fibre_g: number | null;
}

export interface PackagedFoodDetail {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  nutrientsPer100g: PackagedFoodNutrients;
}

/** Same MacroBreakdown shape FoodLogService exports, plus name/brand for enrichWithMacros's
 * food_name snapshot - duplicated rather than imported, since food-log.service.ts needs to
 * import PackagedFoodService (to enrich packaged-food log rows), and importing back from there
 * would create a cycle. */
export interface PackagedFoodMacroBreakdown {
  name: string;
  brand: string | null;
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
}

interface PackagedFoodRow {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  nutrients: PackagedFoodNutrients;
}

interface OffProduct {
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
}

const OFF_USER_AGENT = "FitnessApp-Dev/1.0 (barcode lookup - see PRD.md section 6)";

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

@Injectable()
export class PackagedFoodService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Checks our own cache first (app.packaged_food, keyed by barcode - ODbL/Open Food Facts data,
   * kept out of the CC BY/CC0 indb tables per ARCHITECTURE.md §2/PRD §6); on a miss, looks it up
   * from the real Open Food Facts API and caches the result. Null means genuinely not found in
   * either place - the client shows PRD §5.5's "not found, add it" flow (reusing the existing
   * custom-food creation path, not a new one).
   */
  async lookupByBarcode(barcode: string): Promise<PackagedFoodDetail | null> {
    const cached = await this.db.query<PackagedFoodRow>(
      "SELECT id, barcode, name, brand, nutrients FROM app.packaged_food WHERE barcode = $1",
      [barcode],
    );
    if (cached.rows[0]) {
      return this.toDetail(cached.rows[0]);
    }

    const product = await this.fetchFromOpenFoodFacts(barcode);
    if (!product) {
      return null;
    }

    const nutrients = this.mapNutrients(product.nutriments ?? {});
    const result = await this.db.query<PackagedFoodRow>(
      `INSERT INTO app.packaged_food (barcode, name, brand, nutrients, source)
       VALUES ($1, $2, $3, $4, 'off')
       ON CONFLICT (barcode) DO UPDATE SET
         name = EXCLUDED.name, brand = EXCLUDED.brand, nutrients = EXCLUDED.nutrients
       RETURNING id, barcode, name, brand, nutrients`,
      [barcode, product.product_name?.trim() || `Product ${barcode}`, product.brands?.trim() || null, JSON.stringify(nutrients)],
    );
    return this.toDetail(result.rows[0]);
  }

  /** Batched nutrient lookup for FoodLogService's enrichWithMacros, mirroring FoodService's
   * getNutrientSummaries for indb - one query for a whole day's/sync pull's worth of rows. */
  async getNutrientSummaries(ids: string[]): Promise<Map<string, PackagedFoodMacroBreakdown>> {
    if (ids.length === 0) {
      return new Map();
    }
    const result = await this.db.query<Pick<PackagedFoodRow, "id" | "name" | "brand" | "nutrients">>(
      "SELECT id, name, brand, nutrients FROM app.packaged_food WHERE id = ANY($1)",
      [ids],
    );
    return new Map(
      result.rows.map((row) => [
        row.id,
        {
          name: row.name,
          brand: row.brand,
          kcal: row.nutrients.energy_kcal,
          proteinG: row.nutrients.protein_g,
          fatG: row.nutrients.fat_g,
          carbG: row.nutrients.carb_g,
        },
      ]),
    );
  }

  private toDetail(row: PackagedFoodRow): PackagedFoodDetail {
    return { id: row.id, barcode: row.barcode, name: row.name, brand: row.brand, nutrientsPer100g: row.nutrients };
  }

  private mapNutrients(nutriments: Record<string, unknown>): PackagedFoodNutrients {
    return {
      energy_kcal: numberOrNull(nutriments["energy-kcal_100g"]),
      protein_g: numberOrNull(nutriments["proteins_100g"]),
      fat_g: numberOrNull(nutriments["fat_100g"]),
      carb_g: numberOrNull(nutriments["carbohydrates_100g"]),
      fibre_g: numberOrNull(nutriments["fiber_100g"]),
    };
  }

  private async fetchFromOpenFoodFacts(barcode: string): Promise<OffProduct | null> {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments`,
      { headers: { "User-Agent": OFF_USER_AGENT } },
    );
    if (!response.ok) {
      throw new Error(`Open Food Facts request failed with status ${response.status}`);
    }
    const body = (await response.json()) as { status: number; product?: OffProduct };
    return body.status === 1 && body.product ? body.product : null;
  }
}
