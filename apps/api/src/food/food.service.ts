import { Injectable } from "@nestjs/common";
import { isAllowed, type DietClass, type DietType, type FoodReportRequest } from "@fitness-app/shared";
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
  name: string;
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

    // indb's own fuzzy search + our app-owned regional-name aliases (0006_food_alias.sql), run
    // together. search_foods() is issued first so its query shape stays the stable, asserted one.
    const [builtIn, aliasHits] = await Promise.all([
      this.db.query<Omit<SearchFoodsRow, "dietClass">>("SELECT * FROM search_foods($1, $2)", [
        q,
        overFetchLimit,
      ]),
      this.searchAliases(q, overFetchLimit),
    ]);

    // Dedupe by food code, keeping the higher score. An exact alias match carries a score above
    // search_foods()'s [0,1] range (see searchAliases), so a known regional name like "chawal"
    // surfaces its plain ingredient (A014 "Rice...") ahead of fuzzy recipe hits ("Boiled rice").
    // Score is the primary key; recipe-before-ingredient is only a tiebreaker (search_foods orders
    // recipe-first unconditionally, but that must not bury a high-scoring alias ingredient match).
    const byCode = new Map<string, Omit<SearchFoodsRow, "dietClass">>();
    for (const row of [...builtIn.rows, ...aliasHits]) {
      const existing = byCode.get(row.code);
      if (!existing || row.score > existing.score) {
        byCode.set(row.code, row);
      }
    }
    const merged = [...byCode.values()].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return Number(b.food_type === "recipe") - Number(a.food_type === "recipe");
    });

    const dietClassByCode = await this.getDietClasses(merged.map((row) => row.code));
    const withDietClass: SearchFoodsRow[] = merged.map((row) => ({
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

  /**
   * Regional-name alias search over app.food_alias (0006_food_alias.sql), joined back to public.food
   * by code. Same `%`/ILIKE/similarity() shape as indb's search_foods() so results merge cleanly.
   * An exact (case-insensitive) alias match scores 1.5 - above similarity()'s [0,1] range - so a
   * curated regional name beats a fuzzy indb match for the same query.
   */
  private async searchAliases(q: string, limit: number): Promise<Omit<SearchFoodsRow, "dietClass">[]> {
    const result = await this.db.query<{
      food_id: number;
      code: string;
      name: string;
      food_type: string;
      score: number | string;
    }>(
      `SELECT f.id AS food_id, f.code, f.name, f.food_type,
              max(GREATEST(similarity(a.alias, $1),
                           CASE WHEN lower(a.alias) = lower($1) THEN 1.5 ELSE 0 END)) AS score
       FROM app.food_alias a JOIN food f ON f.code = a.food_code
       WHERE a.alias % $1 OR a.alias ILIKE '%' || $1 || '%'
       GROUP BY f.id, f.code, f.name, f.food_type
       ORDER BY score DESC
       LIMIT $2`,
      [q, limit],
    );
    return result.rows.map((row) => ({ ...row, score: Number(row.score) }));
  }

  /**
   * Records a user's "can't find it" / "numbers look wrong" report in app.food_report (0008) for
   * out-of-band review. One-way write; nothing is synced back. Returns the new report id.
   */
  async reportFood(accountId: string, input: FoodReportRequest): Promise<{ id: string }> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO app.food_report (account_id, kind, query, food_ref, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [accountId, input.kind, input.query ?? null, input.foodRef ?? null, input.note ?? null],
    );
    return { id: result.rows[0].id };
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
    const foodResult = await this.db.query<{ id: number; code: string; name: string }>(
      "SELECT id, code, name FROM food WHERE code = ANY($1)",
      [codes],
    );
    const idByCode = new Map(foodResult.rows.map((row) => [row.code, row.id]));
    const ids = [...idByCode.values()];
    if (ids.length === 0) {
      return new Map();
    }

    const summaryByFoodId = new Map<number, FoodNutrientSummary>(
      foodResult.rows.map((row) => [
        row.id,
        {
          name: row.name,
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
