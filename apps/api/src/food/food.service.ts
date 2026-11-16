import { Injectable } from "@nestjs/common";
import { isAllowed, type DietClass, type DietType } from "@fitness-app/shared";
import { DatabaseService } from "../database/database.service.js";

interface SearchFoodsRow {
  food_id: number;
  code: string;
  name: string;
  food_type: string;
  score: number;
  dietClass: DietClass | null;
}

interface DietClassEntry {
  dietClass: DietClass | null;
  jainOk: boolean | null;
}

interface FoodRow {
  id: number;
  code: string;
  name: string;
  food_type: string;
}

interface FoodNutrientRow {
  nutrient_code: string;
  per_100g: string | null;
  per_serving: string | null;
}

interface ServingMeasureRow {
  name: string;
  grams: string | null;
  is_default: boolean;
}

export interface FoodNutrientSummary {
  kcalPer100g: number | null;
  proteinGPer100g: number | null;
  fatGPer100g: number | null;
  carbGPer100g: number | null;
  servingGramsByName: Record<string, number>;
}

export interface FoodDetail {
  code: string;
  name: string;
  foodType: string;
  nutrientsPer100g: {
    kcal: number | null;
    proteinG: number | null;
    fatG: number | null;
    carbG: number | null;
    fibreG: number | null;
  };
  servingMeasures: { name: string; grams: number | null; isDefault: boolean }[];
  dietClass: DietClass | null;
  jainOk: boolean | null;
}

const NUTRIENT_KEY_BY_CODE: Record<string, keyof FoodDetail["nutrientsPer100g"]> = {
  energy_kcal: "kcal",
  protein_g: "proteinG",
  fat_g: "fatG",
  carb_g: "carbG",
  fibre_g: "fibreG",
};

@Injectable()
export class FoodService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Thin wrapper over indb.search_foods() (db/0001_indb.sql) - fuzzy name search across INDB recipes
   * and ingredients, already multilingual-ready via food_name (ARCHITECTURE.md section 6).
   *
   * When `dietType` is given, over-fetches from search_foods() (it has no diet awareness - that
   * lives in app.food_diet_class, a separate app-owned table, never a column on public.food - see
   * 0005_food_diet_class.sql) and filters in application code. A food with no classification row
   * is "unverified", not excluded - it's always included (see isAllowed's docstring).
   */
  async search(q: string, limit: number, dietType?: DietType): Promise<SearchFoodsRow[]> {
    const overFetchLimit = dietType ? Math.min(limit * 4, 200) : limit;
    const result = await this.db.query<Omit<SearchFoodsRow, "dietClass">>(
      "SELECT * FROM search_foods($1, $2)",
      [q, overFetchLimit],
    );

    const dietClassByCode = await this.getDietClasses(result.rows.map((row) => row.code));
    const withDietClass: SearchFoodsRow[] = result.rows.map((row) => ({
      ...row,
      dietClass: dietClassByCode.get(row.code)?.dietClass ?? null,
    }));

    if (!dietType) {
      return withDietClass.slice(0, limit);
    }

    const filtered = withDietClass.filter((row) => {
      const entry = dietClassByCode.get(row.code);
      return isAllowed(dietType, entry?.dietClass ?? null, entry?.jainOk ?? null);
    });
    return filtered.slice(0, limit);
  }

  private async getDietClasses(codes: string[]): Promise<Map<string, DietClassEntry>> {
    if (codes.length === 0) {
      return new Map();
    }
    const result = await this.db.query<{ food_code: string; diet_class: DietClass | null; jain_ok: boolean | null }>(
      "SELECT food_code, diet_class, jain_ok FROM app.food_diet_class WHERE food_code = ANY($1)",
      [codes],
    );
    return new Map(
      result.rows.map((row) => [row.food_code, { dietClass: row.diet_class, jainOk: row.jain_ok }]),
    );
  }

  /**
   * Per-100g macros + serving measures for one INDB food, by code - needed before a food_log entry
   * can show real nutrition (search_foods() alone returns no nutrient data).
   */
  async getDetail(code: string): Promise<FoodDetail | null> {
    const foodResult = await this.db.query<FoodRow>(
      "SELECT id, code, name, food_type FROM food WHERE code = $1",
      [code],
    );
    const food = foodResult.rows[0];
    if (!food) {
      return null;
    }

    const [nutrientResult, servingResult, dietClassByCode] = await Promise.all([
      this.db.query<FoodNutrientRow>(
        `SELECT n.code AS nutrient_code, fn.per_100g, fn.per_serving
         FROM food_nutrient fn JOIN nutrient n ON n.id = fn.nutrient_id
         WHERE fn.food_id = $1`,
        [food.id],
      ),
      this.db.query<ServingMeasureRow>(
        "SELECT name, grams, is_default FROM serving_measure WHERE food_id = $1",
        [food.id],
      ),
      this.getDietClasses([food.code]),
    ]);
    const dietClassEntry = dietClassByCode.get(food.code);

    const nutrientsPer100g: FoodDetail["nutrientsPer100g"] = {
      kcal: null,
      proteinG: null,
      fatG: null,
      carbG: null,
      fibreG: null,
    };
    for (const row of nutrientResult.rows) {
      const key = NUTRIENT_KEY_BY_CODE[row.nutrient_code];
      if (key) {
        nutrientsPer100g[key] = row.per_100g === null ? null : Number(row.per_100g);
      }
    }

    return {
      code: food.code,
      name: food.name,
      foodType: food.food_type,
      nutrientsPer100g,
      servingMeasures: servingResult.rows.map((row) => ({
        name: row.name,
        grams: row.grams === null ? null : Number(row.grams),
        isDefault: row.is_default,
      })),
      dietClass: dietClassEntry?.dietClass ?? null,
      jainOk: dietClassEntry?.jainOk ?? null,
    };
  }

  /**
   * Batched version of getDetail's nutrient lookup, keyed by code - used to enrich a day's worth of
   * food_log rows in one round trip instead of one query per row.
   */
  async getNutrientSummaries(codes: string[]): Promise<Map<string, FoodNutrientSummary>> {
    if (codes.length === 0) {
      return new Map();
    }
    const foodResult = await this.db.query<{ id: number; code: string }>(
      "SELECT id, code FROM food WHERE code = ANY($1)",
      [codes],
    );
    const idByCode = new Map(foodResult.rows.map((row) => [row.code, row.id]));
    const ids = [...idByCode.values()];
    if (ids.length === 0) {
      return new Map();
    }

    const summaryByFoodId = new Map<number, FoodNutrientSummary>(
      ids.map((id) => [
        id,
        {
          kcalPer100g: null,
          proteinGPer100g: null,
          fatGPer100g: null,
          carbGPer100g: null,
          servingGramsByName: {},
        },
      ]),
    );

    const [nutrientResult, servingResult] = await Promise.all([
      this.db.query<{ food_id: number; nutrient_code: string; per_100g: string | null }>(
        `SELECT fn.food_id, n.code AS nutrient_code, fn.per_100g
         FROM food_nutrient fn JOIN nutrient n ON n.id = fn.nutrient_id
         WHERE fn.food_id = ANY($1)`,
        [ids],
      ),
      this.db.query<{ food_id: number; name: string; grams: string | null }>(
        "SELECT food_id, name, grams FROM serving_measure WHERE food_id = ANY($1)",
        [ids],
      ),
    ]);

    for (const row of nutrientResult.rows) {
      const summary = summaryByFoodId.get(row.food_id);
      if (!summary) continue;
      const value = row.per_100g === null ? null : Number(row.per_100g);
      if (row.nutrient_code === "energy_kcal") summary.kcalPer100g = value;
      else if (row.nutrient_code === "protein_g") summary.proteinGPer100g = value;
      else if (row.nutrient_code === "fat_g") summary.fatGPer100g = value;
      else if (row.nutrient_code === "carb_g") summary.carbGPer100g = value;
    }
    for (const row of servingResult.rows) {
      const summary = summaryByFoodId.get(row.food_id);
      if (summary && row.grams !== null) {
        summary.servingGramsByName[row.name] = Number(row.grams);
      }
    }

    const summaryByCode = new Map<string, FoodNutrientSummary>();
    for (const [code, id] of idByCode) {
      const summary = summaryByFoodId.get(id);
      if (summary) summaryByCode.set(code, summary);
    }
    return summaryByCode;
  }
}
