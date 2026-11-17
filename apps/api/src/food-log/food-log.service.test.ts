import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { FoodService } from "../food/food.service.js";
import { PackagedFoodService } from "../packaged-food/packaged-food.service.js";
import { FoodLogService } from "./food-log.service.js";

describe("FoodLogService", () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let food: { getNutrientSummaries: ReturnType<typeof vi.fn> };
  let packagedFood: { getNutrientSummaries: ReturnType<typeof vi.fn> };
  let service: FoodLogService;

  beforeEach(async () => {
    db = { query: vi.fn() };
    food = { getNutrientSummaries: vi.fn().mockResolvedValue(new Map()) };
    packagedFood = { getNutrientSummaries: vi.fn().mockResolvedValue(new Map()) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FoodLogService,
        { provide: DatabaseService, useValue: db },
        { provide: FoodService, useValue: food },
        { provide: PackagedFoodService, useValue: packagedFood },
      ],
    }).compile();
    service = moduleRef.get(FoodLogService);
  });

  describe("create", () => {
    it("inserts with the client-generated id and account id from the JWT", async () => {
      const row = { id: "log-1", account_id: "account-1" };
      db.query.mockResolvedValue({ rows: [row] });

      const result = await service.create("account-1", {
        id: "log-1",
        foodSource: "indb",
        foodRef: "L002",
        quantity: 150,
        unit: "g",
        mealType: "lunch",
        loggedAt: "2026-11-14T12:00:00.000Z",
        source: "manual",
        isEstimate: false,
      });

      expect(result).toEqual(row);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO app.food_log"),
        ["log-1", "account-1", "indb", "L002", 150, "g", "lunch", "2026-11-14T12:00:00.000Z", "manual", false],
      );
    });
  });

  describe("listByDate", () => {
    it("computes macros for an indb-sourced entry logged in grams", async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: "log-1",
            account_id: "account-1",
            food_source: "indb",
            food_ref: "L002",
            quantity: "200",
            unit: "g",
            meal_type: "lunch",
          },
        ],
      });
      food.getNutrientSummaries.mockResolvedValue(
        new Map([
          [
            "L002",
            {
              name: "Idli",
              kcalPer100g: 130,
              proteinGPer100g: 2.7,
              fatGPer100g: 0.3,
              carbGPer100g: 28,
              servingGramsByName: {},
            },
          ],
        ]),
      );

      const [entry] = await service.listByDate("account-1", "2026-11-14");

      expect(entry.macros).toEqual({ kcal: 260, proteinG: 5.4, fatG: 0.6, carbG: 56 });
      expect(entry.food_name).toBe("Idli");
    });

    it("leaves macros null when the food has no nutrient summary (e.g. custom/packaged)", async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: "log-1",
            account_id: "account-1",
            food_source: "custom",
            food_ref: "custom-food-1",
            quantity: "1",
            unit: "serving",
            meal_type: "snack",
          },
        ],
      });

      const [entry] = await service.listByDate("account-1", "2026-11-14");

      expect(entry.macros).toBeNull();
    });

    it("computes macros for a packaged-food entry (quantity always in grams)", async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: "log-1",
            account_id: "account-1",
            food_source: "packaged",
            food_ref: "packaged-food-1",
            quantity: "50",
            unit: "g",
            meal_type: "snack",
          },
        ],
      });
      packagedFood.getNutrientSummaries.mockResolvedValue(
        new Map([["packaged-food-1", { name: "Cola", brand: "Acme", kcal: 500, proteinG: 10, fatG: 20, carbG: 60 }]]),
      );

      const [entry] = await service.listByDate("account-1", "2026-11-14");

      expect(packagedFood.getNutrientSummaries).toHaveBeenCalledWith(["packaged-food-1"]);
      expect(entry.macros).toEqual({ kcal: 250, proteinG: 5, fatG: 10, carbG: 30 });
      expect(entry.food_name).toBe("Cola (Acme)");
    });

    it("computes macros for a custom-food entry from its indb-sourced ingredients", async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: "log-1",
              account_id: "account-1",
              food_source: "custom",
              food_ref: "custom-food-1",
              quantity: "100", // grams of the recipe logged
              unit: "g",
              meal_type: "snack",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { custom_food_id: "custom-food-1", food_source: "indb", food_ref: "L002", quantity_g: "50" },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: "custom-food-1", name: "Overnight oats" }],
        });
      food.getNutrientSummaries.mockResolvedValue(
        new Map([
          ["L002", { name: "Idli", kcalPer100g: 130, proteinGPer100g: 2.7, fatGPer100g: 0.3, carbGPer100g: 28, servingGramsByName: {} }],
        ]),
      );

      const [entry] = await service.listByDate("account-1", "2026-11-14");

      expect(entry.macros).toEqual({ kcal: 130, proteinG: 2.7, fatG: 0.3, carbG: 28 });
      expect(entry.food_name).toBe("Overnight oats");
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("FROM app.custom_food_ingredient"),
        [["custom-food-1"]],
      );
      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("FROM app.custom_food"),
        [["custom-food-1"]],
      );
    });
  });

  describe("update and softDelete ownership checks", () => {
    it("throws NotFoundException when the entry does not exist", async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(service.update("account-1", "missing", {})).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when the entry belongs to a different account", async () => {
      db.query.mockResolvedValue({ rows: [{ id: "log-1", account_id: "someone-else" }] });

      await expect(service.softDelete("account-1", "log-1")).rejects.toThrow(ForbiddenException);
    });
  });
});
