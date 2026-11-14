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
        .mockResolvedValueOnce({ rows: [{ name: "bowl", grams: "150", is_default: true }] });

      const detail = await service.getDetail("L002");

      expect(detail).toEqual({
        code: "L002",
        name: "Rice",
        foodType: "ingredient",
        nutrientsPer100g: { kcal: 130, proteinG: 2.7, fatG: null, carbG: null, fibreG: null },
        servingMeasures: [{ name: "bowl", grams: 150, isDefault: true }],
      });
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
