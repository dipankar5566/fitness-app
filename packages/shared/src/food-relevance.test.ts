import { describe, expect, it } from "vitest";
import {
  MEAL_TYPES,
  mealPriorForName,
  scoreMealRelevance,
  type MealRelevance,
} from "./food-relevance.ts";

const sum = (r: MealRelevance) => MEAL_TYPES.reduce((s, m) => s + r[m], 0);

describe("scoreMealRelevance", () => {
  it("always produces a normalized distribution (sums to 1)", () => {
    expect(sum(scoreMealRelevance({}))).toBeCloseTo(1, 10);
    expect(sum(scoreMealRelevance({ breakfast: 3, dinner: 7 }))).toBeCloseTo(1, 10);
  });

  it("with no logs, the score is exactly the prior", () => {
    const prior: MealRelevance = { breakfast: 0.1, lunch: 0.2, dinner: 0.3, snack: 0.4 };
    const score = scoreMealRelevance({}, prior);
    for (const meal of MEAL_TYPES) {
      expect(score[meal]).toBeCloseTo(prior[meal], 10);
    }
  });

  it("ranks the most-logged meal highest", () => {
    const score = scoreMealRelevance({ breakfast: 10, lunch: 1, dinner: 1, snack: 1 });
    expect(score.breakfast).toBeGreaterThan(score.lunch);
    expect(score.breakfast).toBeGreaterThan(score.dinner);
    expect(score.breakfast).toBeGreaterThan(score.snack);
  });

  it("lets real logs wash out a contrary prior as counts grow", () => {
    // Prior leans breakfast, but the food is logged overwhelmingly at dinner.
    const prior: MealRelevance = { breakfast: 0.7, lunch: 0.1, dinner: 0.1, snack: 0.1 };
    const few = scoreMealRelevance({ dinner: 2 }, prior);
    const many = scoreMealRelevance({ dinner: 200 }, prior);
    // With few logs the prior still wins; with many, dinner dominates.
    expect(few.breakfast).toBeGreaterThan(few.dinner);
    expect(many.dinner).toBeGreaterThan(many.breakfast);
    // And the prior's pull toward breakfast weakens as evidence grows.
    expect(many.breakfast).toBeLessThan(few.breakfast);
  });

  it("treats negative/missing counts as zero", () => {
    const a = scoreMealRelevance({ breakfast: -5, lunch: 4 });
    const b = scoreMealRelevance({ lunch: 4 });
    for (const meal of MEAL_TYPES) {
      expect(a[meal]).toBeCloseTo(b[meal], 10);
    }
  });
});

describe("mealPriorForName", () => {
  it("returns a normalized distribution", () => {
    expect(sum(mealPriorForName("Masala dosa"))).toBeCloseTo(1, 10);
    expect(sum(mealPriorForName("Something unknown"))).toBeCloseTo(1, 10);
  });

  it("tilts a breakfast dish toward breakfast", () => {
    const prior = mealPriorForName("Masala dosa");
    expect(prior.breakfast).toBeGreaterThan(prior.lunch);
    expect(prior.breakfast).toBeGreaterThan(prior.dinner);
    expect(prior.breakfast).toBeGreaterThan(prior.snack);
  });

  it("tilts a snack toward snack", () => {
    const prior = mealPriorForName("Aloo samosa");
    expect(prior.snack).toBeGreaterThan(prior.breakfast);
    expect(prior.snack).toBeGreaterThan(prior.lunch);
  });

  it("leans a generic heavy dish toward lunch/dinner over breakfast", () => {
    const prior = mealPriorForName("Mutton biryani");
    expect(prior.lunch).toBeGreaterThan(prior.breakfast);
    expect(prior.dinner).toBeGreaterThan(prior.breakfast);
    expect(prior.lunch).toBeCloseTo(prior.dinner, 10);
  });
});
