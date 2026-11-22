import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { FoodService } from "./food.service.js";

describe("FoodService", () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let service: FoodService;

  beforeEach(async () => {
    db = { query: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [FoodService, { provide: DatabaseService, useValue: db }],
    }).compile();
    service = moduleRef.get(FoodService);
  });

  describe("getDetail", () => {
    it("returns null when the code does not exist", async () => {
      db.query.mockResolvedValue({ rows: [] });

      expect(await service.getDetail("missing")).toBeNull();
    });

    it("pivots nutrient rows into a per-100g breakdown with serving measures", async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code: "L002", name: "Rice", food_type: "ingredient" }] })
        .mockResolvedValueOnce({
          rows: [
            { nutrient_code: "energy_kcal", per_100g: "130", per_serving: null },
            { nutrient_code: "protein_g", per_100g: "2.7", per_serving: null },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ name: "bowl", grams: "150", is_default: true }] })
        .mockResolvedValueOnce({ rows: [] }); // app.food_diet_class: no classification row yet

      const detail = await service.getDetail("L002");

      expect(detail).toEqual({
        code: "L002",
        name: "Rice",
        foodType: "ingredient",
        nutrientsPer100g: { kcal: 130, proteinG: 2.7, fatG: null, carbG: null, fibreG: null },
        servingMeasures: [{ name: "bowl", grams: 150, isDefault: true }],
        dietClass: null,
        jainOk: null,
      });
    });

    it("attaches a known diet classification", async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code: "L002", name: "Rice", food_type: "ingredient" }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ food_code: "L002", diet_class: "vegan", jain_ok: null }] });

      const detail = await service.getDetail("L002");

      expect(detail?.dietClass).toBe("vegan");
      expect(detail?.jainOk).toBeNull();
    });
  });

  describe("search", () => {
    // Call order is: search_foods(), then the alias lookup (0006_food_alias.sql), then the
    // diet-class lookup. Tests that don't exercise aliases mock an empty alias result in slot 2.
    it("returns results unfiltered, with dietClass attached, when no dietType is given", async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ food_id: 1, code: "ASC001", name: "Chicken biryani", food_type: "recipe", score: 1 }],
        })
        .mockResolvedValueOnce({ rows: [] }) // no alias hits
        .mockResolvedValueOnce({ rows: [{ food_code: "ASC001", diet_class: "non_veg", jain_ok: null }] });

      const results = await service.search("biryani", 20);

      expect(results).toEqual([
        { food_id: 1, code: "ASC001", name: "Chicken biryani", food_type: "recipe", score: 1, dietClass: "non_veg" },
      ]);
      expect(db.query).toHaveBeenCalledWith("SELECT * FROM search_foods($1, $2)", ["biryani", 20]);
    });

    it("filters out a disallowed food but keeps an unverified one, for a given dietType", async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { food_id: 1, code: "ASC001", name: "Chicken biryani", food_type: "recipe", score: 1 },
            { food_id: 2, code: "ASC002", name: "Veg biryani", food_type: "recipe", score: 0.9 },
            { food_id: 3, code: "ASC003", name: "Mystery biryani", food_type: "recipe", score: 0.8 },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // no alias hits
        .mockResolvedValueOnce({
          rows: [
            { food_code: "ASC001", diet_class: "non_veg", jain_ok: null },
            { food_code: "ASC002", diet_class: "vegan", jain_ok: null },
            // ASC003 has no row - unverified.
          ],
        });

      const results = await service.search("biryani", 20, "veg");

      expect(results.map((r) => r.code)).toEqual(["ASC002", "ASC003"]);
    });

    it("over-fetches when filtering by dietType, then slices to the requested limit", async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.search("rice", 5, "vegan");

      expect(db.query).toHaveBeenCalledWith("SELECT * FROM search_foods($1, $2)", ["rice", 20]);
    });

    it("surfaces an alias-only match that search_foods() misses, and ranks an exact alias first", async () => {
      // "chawal" is not in indb's food_name, so search_foods() returns nothing; the alias table
      // maps it to rice. An exact alias match scores 1.5, above the fuzzy range.
      db.query
        .mockResolvedValueOnce({ rows: [] }) // search_foods() miss
        .mockResolvedValueOnce({
          rows: [{ food_id: 7, code: "L002", name: "Rice, raw", food_type: "ingredient", score: 1.5 }],
        })
        .mockResolvedValueOnce({ rows: [{ food_code: "L002", diet_class: "vegan", jain_ok: true }] });

      const results = await service.search("chawal", 20);

      expect(results).toEqual([
        { food_id: 7, code: "L002", name: "Rice, raw", food_type: "ingredient", score: 1.5, dietClass: "vegan" },
      ]);
    });

    it("dedupes a food that both search_foods() and an alias return, keeping the higher score", async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ food_id: 7, code: "L002", name: "Rice, raw", food_type: "ingredient", score: 0.4 }],
        })
        .mockResolvedValueOnce({
          rows: [{ food_id: 7, code: "L002", name: "Rice, raw", food_type: "ingredient", score: 1.5 }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const results = await service.search("rice", 20);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ code: "L002", score: 1.5 });
    });
  });

  describe("getNutrientSummaries", () => {
    it("returns an empty map for an empty code list without querying", async () => {
      const summaries = await service.getNutrientSummaries([]);

      expect(summaries.size).toBe(0);
      expect(db.query).not.toHaveBeenCalled();
    });

    it("keys the result by code, not internal food id", async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code: "L002" }] })
        .mockResolvedValueOnce({ rows: [{ food_id: 1, nutrient_code: "energy_kcal", per_100g: "130" }] })
        .mockResolvedValueOnce({ rows: [{ food_id: 1, name: "bowl", grams: "150" }] });

      const summaries = await service.getNutrientSummaries(["L002"]);

      expect(summaries.get("L002")).toEqual({
        kcalPer100g: 130,
        proteinGPer100g: null,
        fatGPer100g: null,
        carbGPer100g: null,
        servingGramsByName: { bowl: 150 },
      });
    });
  });
});
