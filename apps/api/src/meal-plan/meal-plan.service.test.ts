import { BadRequestException, UnprocessableEntityException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiService } from "../ai/ai.service.js";
import { DatabaseService } from "../database/database.service.js";
import { FoodService } from "../food/food.service.js";
import { ProfileService } from "../profile/profile.service.js";
import { MealPlanService } from "./meal-plan.service.js";

const profileRow = {
  account_id: "account-1",
  sex: "male" as const,
  dob: "1998-03-10",
  height_cm: "175",
  activity_level: "moderate" as const,
  diet_type: "veg" as const,
};
const goalRow = {
  id: "goal-1",
  account_id: "account-1",
  mode: "maintain",
  target_kcal: "2000",
  target_protein_g: "100",
  target_carb_g: "250",
  target_fat_g: "60",
  training_day_adjustment_pct: "0",
  is_active: true,
};

// Per-100g nutrients chosen so the scaled plan lands on target: 400 g "paneer" (265 kcal, 18 g P)
// + 400 g "rice" (130 kcal, 2.7 g P) + 400 g "dal" (105 kcal, 7 g P) = 2000 kcal, ~111 g protein.
const NUTRIENTS = new Map([
  ["P01", { name: "Paneer", kcalPer100g: 265, proteinGPer100g: 18, fatGPer100g: 20, carbGPer100g: 1.2, servingGramsByName: {} }],
  ["R01", { name: "Boiled rice", kcalPer100g: 130, proteinGPer100g: 2.7, fatGPer100g: 0.3, carbGPer100g: 28, servingGramsByName: {} }],
  ["D01", { name: "Moong dal", kcalPer100g: 105, proteinGPer100g: 7, fatGPer100g: 0.4, carbGPer100g: 19, servingGramsByName: {} }],
]);

function searchHit(code: string, dietClass: string | null) {
  return { food_id: 1, code, name: code, food_type: "recipe", score: 1, dietClass };
}

describe("MealPlanService", () => {
  let ai: { generateMealPlan: ReturnType<typeof vi.fn> };
  let food: { search: ReturnType<typeof vi.fn>; getNutrientSummaries: ReturnType<typeof vi.fn> };
  let profile: { getProfile: ReturnType<typeof vi.fn>; getLatestWeightKg: ReturnType<typeof vi.fn> };
  let db: { query: ReturnType<typeof vi.fn> };
  let service: MealPlanService;

  beforeEach(async () => {
    ai = { generateMealPlan: vi.fn() };
    food = {
      search: vi.fn(async (name: string) => {
        if (name === "paneer") return [searchHit("P01", "veg")];
        if (name === "rice") return [searchHit("R01", "veg")];
        if (name === "dal") return [searchHit("D01", "veg")];
        if (name === "mystery curry") return [searchHit("X01", null)]; // unverified diet class
        return [];
      }),
      getNutrientSummaries: vi.fn(
        async (codes: string[]) => new Map(codes.filter((c) => NUTRIENTS.has(c)).map((c) => [c, NUTRIENTS.get(c)!])),
      ),
    };
    profile = {
      getProfile: vi.fn().mockResolvedValue({ profile: profileRow, goal: goalRow }),
      getLatestWeightKg: vi.fn().mockResolvedValue(72),
    };
    db = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MealPlanService,
        { provide: AiService, useValue: ai },
        { provide: FoodService, useValue: food },
        { provide: ProfileService, useValue: profile },
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();
    service = moduleRef.get(MealPlanService);
  });

  it("returns a cached same-day plan without calling the model", async () => {
    const cachedPlan = { planDate: "2026-11-23", items: [], totals: {}, targets: {} };
    db.query.mockResolvedValueOnce({ rows: [{ payload: cachedPlan }] });

    await expect(service.generate("account-1")).resolves.toBe(cachedPlan);
    expect(ai.generateMealPlan).not.toHaveBeenCalled();
  });

  it("re-costs suggestions from our own nutrients, scales to target, validates and caches", async () => {
    ai.generateMealPlan.mockResolvedValue([
      { mealType: "lunch", name: "paneer", grams: 200 },
      { mealType: "lunch", name: "rice", grams: 200 },
      { mealType: "dinner", name: "dal", grams: 200 },
    ]); // 1000 kcal as suggested - must be scaled up ~2x

    const plan = await service.generate("account-1");

    expect(Math.abs(plan.totals.kcal - 2000) / 2000).toBeLessThanOrEqual(0.05);
    expect(plan.items.map((i) => i.foodRef)).toEqual(["P01", "R01", "D01"]);
    expect(plan.items[0].foodName).toBe("Paneer"); // our name, not the model's
    expect(food.search).toHaveBeenCalledWith("paneer", expect.any(Number), "veg");
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO app.meal_plan"),
      expect.arrayContaining(["account-1"]),
    );
    expect(ai.generateMealPlan).toHaveBeenCalledTimes(1);
  });

  it("skips diet-unverified foods for a veg account instead of recommending them", async () => {
    ai.generateMealPlan.mockResolvedValue([
      { mealType: "lunch", name: "paneer", grams: 400 },
      { mealType: "lunch", name: "rice", grams: 400 },
      { mealType: "dinner", name: "dal", grams: 400 },
      { mealType: "dinner", name: "mystery curry", grams: 200 },
    ]);

    const plan = await service.generate("account-1");

    expect(plan.items.map((i) => i.foodRef)).not.toContain("X01");
  });

  it("retries once with the validation problems, then refuses rather than show an off-target plan", async () => {
    ai.generateMealPlan.mockResolvedValue([{ mealType: "lunch", name: "rice", grams: 100 }]); // can't reach protein

    await expect(service.generate("account-1")).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(ai.generateMealPlan).toHaveBeenCalledTimes(2);
    expect(ai.generateMealPlan.mock.calls[1][1].feedback.join(" ")).toMatch(/protein|kcal/i);
    expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO app.meal_plan"), expect.anything());
  });

  it("refuses a target below the safe calorie floor without calling the model", async () => {
    profile.getProfile.mockResolvedValue({ profile: profileRow, goal: { ...goalRow, target_kcal: "1000" } });

    await expect(service.generate("account-1")).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(ai.generateMealPlan).not.toHaveBeenCalled();
  });

  it("asks a not-yet-onboarded account to finish onboarding", async () => {
    profile.getProfile.mockResolvedValue({ profile: null, goal: null });

    await expect(service.generate("account-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(ai.generateMealPlan).not.toHaveBeenCalled();
  });
});
