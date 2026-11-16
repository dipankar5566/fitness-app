import { Injectable } from "@nestjs/common";
import { FoodService } from "../food/food.service.js";
import type { RawMealItem } from "./ai-provider.interface.js";
import { AiService } from "./ai.service.js";

export interface MealDraftItem {
  /** As the model extracted it from the text - never shown as the "real" name once matched. */
  rawName: string;
  rawQuantity: number;
  rawUnit: string;
  /** null when search-then-match found nothing usable - the client must let the user pick a food
   * manually (e.g. via the existing food search) before this item can be logged at all, since
   * app.food_log.food_ref is NOT NULL. */
  foodSource: "indb" | null;
  foodRef: string | null;
  foodName: string | null;
  /** Passed through from the raw extraction unedited - the client resolves it against the matched
   * food's real serving measures (same resolveGrams logic LogFoodScreen already uses for manual
   * entry) and lets the user fix it before confirming. */
  quantity: number;
  unit: string;
  isEstimate: boolean;
}

@Injectable()
export class AiMealDraftService {
  constructor(
    private readonly ai: AiService,
    private readonly food: FoodService,
  ) {}

  /**
   * ARCHITECTURE.md §5: "ParsedMeal items are always resolved to a food_id in our DB
   * (search-then-match, not free text) or explicitly flagged is_estimate" - a matched item is
   * never flagged is_estimate (its quantity may still need editing, but the AI gateway's own
   * uncertainty was about which food this is, not the number); an unmatched one always is.
   */
  async resolveDraft(text: string): Promise<MealDraftItem[]> {
    const rawItems = await this.ai.parseMealText(text);
    return this.resolveItems(rawItems, false);
  }

  /**
   * Same search-then-match resolution as resolveDraft, but every item is forced is_estimate -
   * a photo gives a visual portion estimate, never a number the user actually stated, so the
   * quantity itself is always approximate here regardless of whether the food matched.
   */
  async resolveDraftFromImage(image: Buffer, mimeType: string): Promise<MealDraftItem[]> {
    const rawItems = await this.ai.parseMealImage(image, mimeType);
    return this.resolveItems(rawItems, true);
  }

  private async resolveItems(rawItems: RawMealItem[], forceEstimate: boolean): Promise<MealDraftItem[]> {
    return Promise.all(
      rawItems.map(async (raw) => {
        const [bestMatch] = await this.food.search(raw.name, 1);
        if (!bestMatch) {
          return {
            rawName: raw.name,
            rawQuantity: raw.quantity,
            rawUnit: raw.unit,
            foodSource: null,
            foodRef: null,
            foodName: null,
            quantity: raw.quantity,
            unit: raw.unit,
            isEstimate: true,
          };
        }
        return {
          rawName: raw.name,
          rawQuantity: raw.quantity,
          rawUnit: raw.unit,
          foodSource: "indb" as const,
          foodRef: bestMatch.code,
          foodName: bestMatch.name,
          quantity: raw.quantity,
          unit: raw.unit,
          isEstimate: forceEstimate,
        };
      }),
    );
  }
}
