import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FoodService } from "../food/food.service.js";
import { AiMealDraftService } from "./ai-meal-draft.service.js";
import { AiService } from "./ai.service.js";

describe("AiMealDraftService", () => {
  let ai: { parseMealText: ReturnType<typeof vi.fn>; parseMealImage: ReturnType<typeof vi.fn> };
  let food: { search: ReturnType<typeof vi.fn> };
  let service: AiMealDraftService;

  beforeEach(async () => {
    ai = { parseMealText: vi.fn(), parseMealImage: vi.fn() };
    food = { search: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiMealDraftService,
        { provide: AiService, useValue: ai },
        { provide: FoodService, useValue: food },
      ],
    }).compile();
    service = moduleRef.get(AiMealDraftService);
  });

  it("resolves a matched item to a real food_id, not flagged as an estimate", async () => {
    ai.parseMealText.mockResolvedValue([{ name: "roti", quantity: 2, unit: "piece" }]);
    food.search.mockResolvedValue([
      { food_id: 1, code: "L002", name: "Roti", food_type: "recipe", score: 0.9, dietClass: "veg" },
    ]);

    const result = await service.resolveDraft("2 roti");

    expect(food.search).toHaveBeenCalledWith("roti", 1);
    expect(result).toEqual([
      {
        rawName: "roti",
        rawQuantity: 2,
        rawUnit: "piece",
        foodSource: "indb",
        foodRef: "L002",
        foodName: "Roti",
        quantity: 2,
        unit: "piece",
        isEstimate: false,
      },
    ]);
  });

  it("flags an unmatched item as an estimate with no food_id", async () => {
    ai.parseMealText.mockResolvedValue([{ name: "xyz-nonsense-food", quantity: 1, unit: "piece" }]);
    food.search.mockResolvedValue([]);

    const result = await service.resolveDraft("xyz-nonsense-food");

    expect(result).toEqual([
      {
        rawName: "xyz-nonsense-food",
        rawQuantity: 1,
        rawUnit: "piece",
        foodSource: null,
        foodRef: null,
        foodName: null,
        quantity: 1,
        unit: "piece",
        isEstimate: true,
      },
    ]);
  });

  it("resolves multiple items independently in one call", async () => {
    ai.parseMealText.mockResolvedValue([
      { name: "roti", quantity: 2, unit: "piece" },
      { name: "dal", quantity: 1, unit: "bowl" },
    ]);
    food.search
      .mockResolvedValueOnce([{ food_id: 1, code: "L002", name: "Roti", food_type: "recipe", score: 0.9, dietClass: "veg" }])
      .mockResolvedValueOnce([]);

    const result = await service.resolveDraft("2 roti aur dal");

    expect(result).toHaveLength(2);
    expect(result[0].foodRef).toBe("L002");
    expect(result[1].foodRef).toBeNull();
  });

  it("resolveDraftFromImage forces is_estimate even when the food matched", async () => {
    const image = Buffer.from("fake-image-bytes");
    ai.parseMealImage.mockResolvedValue([{ name: "rice", quantity: 1, unit: "bowl" }]);
    food.search.mockResolvedValue([
      { food_id: 2, code: "L010", name: "Rice", food_type: "ingredient", score: 0.95, dietClass: "vegan" },
    ]);

    const result = await service.resolveDraftFromImage(image, "image/jpeg");

    expect(ai.parseMealImage).toHaveBeenCalledWith(image, "image/jpeg");
    expect(result).toEqual([
      {
        rawName: "rice",
        rawQuantity: 1,
        rawUnit: "bowl",
        foodSource: "indb",
        foodRef: "L010",
        foodName: "Rice",
        quantity: 1,
        unit: "bowl",
        isEstimate: true,
      },
    ]);
  });

  it("resolveDraftFromImage still has no food_id for an unmatched item", async () => {
    ai.parseMealImage.mockResolvedValue([{ name: "mystery-dish", quantity: 1, unit: "plate" }]);
    food.search.mockResolvedValue([]);

    const result = await service.resolveDraftFromImage(Buffer.from("x"), "image/png");

    expect(result[0].foodRef).toBeNull();
    expect(result[0].isEstimate).toBe(true);
  });
});
