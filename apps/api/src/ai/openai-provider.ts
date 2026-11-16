import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { AiProvider, RawMealItem } from "./ai-provider.interface.js";

const MEAL_PARSE_MODEL = "gpt-4o-mini"; // cheap model for parsing; gpt-4o reserved for the M5 coach

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

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;

  constructor(config: ConfigService) {
    this.client = new OpenAI({ apiKey: config.getOrThrow<string>("OPENAI_API_KEY") });
  }

  async parseMealText(text: string): Promise<RawMealItem[]> {
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
    return parsed.items;
  }
}
