import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { AiUsageService, type AiFeature } from "./ai-usage.service.js";
import type { AiProvider, ChatMessage, MealPlanRequest, RawMealItem, RawPlanItem } from "./ai-provider.interface.js";

const MEAL_PARSE_MODEL = "gpt-4o-mini"; // cheap model for parsing
const COACH_CHAT_MODEL = "gpt-4o"; // PRD §9: gpt-4o reserved for the M5 coach

// Pricing in USD per 1M tokens, as of choosing these models (PRD §9) - approximate and not
// re-fetched from OpenAI, used only to estimate app.ai_usage.cost_usd for the daily quota
// (AiUsageService), not for real billing. Update if OpenAI's published pricing changes materially.
const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
};

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    throw new Error(`No pricing configured for model "${model}"`);
  }
  return (tokensIn * pricing.inputPerMillion + tokensOut * pricing.outputPerMillion) / 1_000_000;
}

const mealItemsSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.string(),
    }),
  ),
});

const SYSTEM_PROMPT = `You extract the food items mentioned in a meal description written by an \
Indian user. The text may be in English, Hindi, or a mix of both (Hinglish). For each distinct \
food item mentioned, extract:
- name: exactly as the user wrote it - do not translate, correct spelling, or normalize it.
- quantity: a number. If the user didn't give one, use 1.
- unit: a sensible unit implied by the text (e.g. piece, bowl, plate, cup, katori, g, ml). If \
unclear, use "piece".
Do not invent items the user didn't mention. Return only the items actually in the text.`;

const SYSTEM_PROMPT_PHOTO = `You identify the food items visible in a photo of an Indian user's \
meal. For each distinct food item you can see, extract:
- name: a short English name for the dish/item (e.g. "roti", "dal", "rice").
- quantity: your best visual estimate of how many/how much is in the photo (count pieces when \
countable, otherwise estimate a sensible number of servings).
- unit: a sensible unit for that estimate (e.g. piece, bowl, plate, cup, katori, g, ml).
These are visual estimates, not exact counts - give your best reasonable guess rather than \
refusing to answer. Do not list items that aren't actually visible in the photo.`;

const mealPlanSchema = z.object({
  items: z.array(
    z.object({
      mealType: z.enum(["breakfast", "lunch", "snack", "dinner"]),
      name: z.string(),
      grams: z.number(),
    }),
  ),
});

const DIET_RULES: Record<string, string> = {
  veg: "Vegetarian: no meat, fish or egg. Dairy is fine.",
  eggetarian: "Vegetarian plus eggs: no meat or fish.",
  non_veg: "No restriction - meat, fish, egg and dairy are all fine.",
  vegan: "Vegan: no meat, fish, egg, dairy, ghee, paneer, curd or honey.",
  jain: "Jain: vegetarian with no onion, garlic, potato or other root vegetables; no egg.",
};

const MEAL_PLAN_SYSTEM_PROMPT = `You plan one day of everyday Indian home-style meals for a \
gym-goer. Use common, simple foods and dishes (e.g. roti, rice, dal, sabzi, idli, poha, paneer, \
curd, eggs, chicken curry, fruit). For every item give:
- mealType: breakfast, lunch, snack or dinner
- name: a short plain English name of a single food or dish, as it would appear in an Indian food \
database (e.g. "Chapati", "Moong dal", "Paneer bhurji") - one food per item, no combinations
- grams: a realistic cooked/served weight in grams
Aim the day's total close to the targets given, with protein at or above its target. Strictly \
follow the diet rule. Return 2-4 items per meal.`;

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;

  constructor(
    config: ConfigService,
    private readonly usage: AiUsageService,
  ) {
    this.client = new OpenAI({ apiKey: config.getOrThrow<string>("OPENAI_API_KEY") });
  }

  async parseMealText(accountId: string, text: string): Promise<RawMealItem[]> {
    const completion = await this.client.chat.completions.parse({
      model: MEAL_PARSE_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: zodResponseFormat(mealItemsSchema, "meal_items"),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error("OpenAI returned no parsed meal items");
    }
    await this.recordUsage(accountId, "meal_parse_text", MEAL_PARSE_MODEL, completion.usage);
    return parsed.items;
  }

  async parseMealImage(accountId: string, image: Buffer, mimeType: string): Promise<RawMealItem[]> {
    const completion = await this.client.chat.completions.parse({
      model: MEAL_PARSE_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_PHOTO },
        {
          role: "user",
          content: [
            { type: "text", text: "What food items are in this meal photo?" },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${image.toString("base64")}` } },
          ],
        },
      ],
      response_format: zodResponseFormat(mealItemsSchema, "meal_items"),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error("OpenAI returned no parsed meal items");
    }
    await this.recordUsage(accountId, "meal_parse_image", MEAL_PARSE_MODEL, completion.usage);
    return parsed.items;
  }

  async chat(accountId: string, messages: ChatMessage[]): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: COACH_CHAT_MODEL,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
    });

    const reply = completion.choices[0]?.message.content;
    if (!reply) {
      throw new Error("OpenAI returned no chat reply");
    }
    await this.recordUsage(accountId, "coach_chat", COACH_CHAT_MODEL, completion.usage);
    return reply;
  }

  async generateMealPlan(accountId: string, request: MealPlanRequest): Promise<RawPlanItem[]> {
    const budgets = request.mealBudgets;
    const userPrompt = [
      `Daily targets: ${request.targetKcal} kcal, ${request.targetProteinG} g protein, ` +
        `${request.targetCarbG} g carbs, ${request.targetFatG} g fat.`,
      `Meal kcal budgets: breakfast ${budgets.breakfast}, lunch ${budgets.lunch}, snack ${budgets.snack}, dinner ${budgets.dinner}.`,
      `Diet rule: ${DIET_RULES[request.dietType] ?? DIET_RULES.non_veg}`,
      ...(request.feedback?.length ? [`Your previous plan had problems - fix them: ${request.feedback.join(" ")}`] : []),
    ].join("\n");

    const completion = await this.client.chat.completions.parse({
      model: MEAL_PARSE_MODEL,
      messages: [
        { role: "system", content: MEAL_PLAN_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: zodResponseFormat(mealPlanSchema, "meal_plan"),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error("OpenAI returned no parsed meal plan");
    }
    await this.recordUsage(accountId, "plan_generate", MEAL_PARSE_MODEL, completion.usage);
    return parsed.items;
  }

  private async recordUsage(
    accountId: string,
    feature: AiFeature,
    model: string,
    usage: { prompt_tokens: number; completion_tokens: number } | null | undefined,
  ): Promise<void> {
    const tokensIn = usage?.prompt_tokens ?? 0;
    const tokensOut = usage?.completion_tokens ?? 0;
    await this.usage.record(accountId, feature, tokensIn, tokensOut, estimateCostUsd(model, tokensIn, tokensOut));
  }
}
