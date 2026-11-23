import { BadRequestException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import {
  calculateAgeYears,
  calculateBmr,
  calculateTdee,
  computeCalorieFloor,
  describeCalorieFloorRefusal,
  isCalorieTargetSafe,
  planTotals,
  scalePlanToTarget,
  splitMealBudgets,
  validatePlanAgainstTargets,
  type DietType,
  type MealPlan,
  type MealPlanItem,
  type PlanMacros,
} from "@fitness-app/shared";
import type { RawPlanItem } from "../ai/ai-provider.interface.js";
import { AiService } from "../ai/ai.service.js";
import { DatabaseService } from "../database/database.service.js";
import { FoodService } from "../food/food.service.js";
import { ProfileService } from "../profile/profile.service.js";

/** One corrective retry (with the validation problems fed back) before giving up - each attempt is
 * a real, quota-counted AI call. */
const MAX_ATTEMPTS = 2;
/** Candidates per suggested name - enough to skip past diet-unverified hits to a verified one. */
const SEARCH_CANDIDATES = 5;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * AI sample-day meal plan (PRD §5.5). The model only *suggests* food names and gram weights; every
 * number the user sees is ours: each suggestion is resolved to a real indb food via the existing
 * search (with the account's diet filter), re-costed from our own per-100g nutrients, scaled toward
 * the kcal target, and validated (±5 % kcal, protein floor - packages/shared/src/meal-plan.ts) before
 * it's ever stored or shown. A target below the safe calorie floor is refused outright, same rule the
 * coach enforces. Cached one plan per account per day (app.meal_plan, 0012) like the daily insight.
 */
@Injectable()
export class MealPlanService {
  constructor(
    private readonly ai: AiService,
    private readonly food: FoodService,
    private readonly profile: ProfileService,
    private readonly db: DatabaseService,
  ) {}

  async getToday(accountId: string): Promise<MealPlan | null> {
    const cached = await this.db.query<{ payload: MealPlan }>(
      "SELECT payload FROM app.meal_plan WHERE account_id = $1 AND plan_date = $2",
      [accountId, todayDate()],
    );
    return cached.rows[0]?.payload ?? null;
  }

  async generate(accountId: string): Promise<MealPlan> {
    const cached = await this.getToday(accountId);
    if (cached) {
      return cached;
    }

    const { profile, goal } = await this.profile.getProfile(accountId);
    if (!profile || !goal) {
      throw new BadRequestException("Finish onboarding to get a meal plan built around your targets.");
    }

    const targets: PlanMacros = {
      kcal: Math.round(Number(goal.target_kcal)),
      proteinG: Math.round(Number(goal.target_protein_g)),
      carbG: Math.round(Number(goal.target_carb_g)),
      fatG: Math.round(Number(goal.target_fat_g)),
    };

    const weightKg = await this.profile.getLatestWeightKg(accountId);
    if (weightKg !== null) {
      const biometrics = {
        sex: profile.sex,
        ageYears: calculateAgeYears(profile.dob),
        heightCm: Number(profile.height_cm),
        weightKg,
        activityLevel: profile.activity_level,
      };
      const floor = computeCalorieFloor(calculateBmr(biometrics), calculateTdee(biometrics));
      if (!isCalorieTargetSafe(targets.kcal, floor)) {
        throw new UnprocessableEntityException(describeCalorieFloorRefusal(floor));
      }
    }

    const dietType = profile.diet_type;
    const mealBudgets = splitMealBudgets(targets.kcal);
    let feedback: string[] | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const raw = await this.ai.generateMealPlan(accountId, {
        targetKcal: targets.kcal,
        targetProteinG: targets.proteinG,
        targetCarbG: targets.carbG,
        targetFatG: targets.fatG,
        dietType,
        mealBudgets,
        feedback,
      });
      const items = scalePlanToTarget(await this.resolve(raw, dietType), targets.kcal);
      const validation = validatePlanAgainstTargets(items, targets);
      if (validation.ok) {
        const plan: MealPlan = { planDate: todayDate(), items, totals: planTotals(items), targets };
        await this.db.query(
          `INSERT INTO app.meal_plan (account_id, plan_date, payload) VALUES ($1, $2, $3)
           ON CONFLICT (account_id, plan_date) DO NOTHING`,
          [accountId, plan.planDate, JSON.stringify(plan)],
        );
        return plan;
      }
      feedback = validation.problems;
    }

    throw new UnprocessableEntityException(
      "Couldn't build a plan that fits your targets right now - please try again later.",
    );
  }

  /**
   * Search-then-match each suggestion against indb with the account's diet filter. Stricter than food
   * search's default for non-non_veg diets: an *unverified* (null diet class) food is skipped here,
   * because unlike a search result the user picks, a plan item is something we're recommending.
   * Suggestions with no usable match or no kcal data are dropped - validation then decides whether
   * what's left still makes a plan.
   */
  private async resolve(raw: RawPlanItem[], dietType: DietType): Promise<MealPlanItem[]> {
    const withCandidates = await Promise.all(
      raw
        .filter((item) => item.grams > 0)
        .map(async (item) => {
          const candidates = await this.food.search(item.name, SEARCH_CANDIDATES, dietType);
          const dietMatches = candidates.filter((c) => dietType === "non_veg" || c.dietClass !== null);
          return { item, dietMatches };
        }),
    );

    // One batched nutrient lookup across every diet-matching candidate for every item (not just
    // the first pick) - a real indb row can have a diet class but null nutrient data (e.g. L003
    // "Paneer" on this database), so picking only the first candidate silently drops a food's best
    // match, taking its macros (protein, for a veg plan's paneer) out of the plan with nothing
    // replacing it. Walking each item's own candidates in order until one has usable nutrients
    // keeps the model's intent (paneer, not some unrelated fallback) while never recommending a
    // food we can't actually cost.
    const allCodes = withCandidates.flatMap((w) => w.dietMatches.map((c) => c.code));
    const summaries = await this.food.getNutrientSummaries([...new Set(allCodes)]);

    const items: MealPlanItem[] = [];
    for (const { item, dietMatches } of withCandidates) {
      for (const candidate of dietMatches) {
        const summary = summaries.get(candidate.code);
        if (!summary || summary.kcalPer100g === null) continue;
        items.push({
          mealType: item.mealType,
          foodSource: "indb",
          foodRef: candidate.code,
          foodName: summary.name,
          grams: Math.round(item.grams),
          kcalPer100g: summary.kcalPer100g,
          proteinGPer100g: summary.proteinGPer100g ?? 0,
          carbGPer100g: summary.carbGPer100g ?? 0,
          fatGPer100g: summary.fatGPer100g ?? 0,
        });
        break;
      }
    }
    return items;
  }
}
