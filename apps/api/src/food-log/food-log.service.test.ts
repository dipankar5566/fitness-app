import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { FoodService } from "../food/food.service.js";
import { FoodLogService } from "./food-log.service.js";

describe("FoodLogService", () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let food: { getNutrientSummaries: ReturnType<typeof vi.fn> };
  let service: FoodLogService;

  beforeEach(async () => {
    db = { query: vi.fn() };
    food = { getNutrientSummaries: vi.fn().mockResolvedValue(new Map()) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FoodLogService,
        { provide: DatabaseService, useValue: db },
        { provide: FoodService, useValue: food },
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
