import { BadRequestException, Body, Controller, Post, UseGuards } from "@nestjs/common";
import { aiParseMealTextRequestSchema } from "@fitness-app/shared";
import { ZodError } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { AiMealDraftService } from "./ai-meal-draft.service.js";
import { AiService } from "./ai.service.js";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly mealDraft: AiMealDraftService,
  ) {}

  /**
   * Raw extraction only - names/quantities/units as the model read them from the text, not
   * resolved to a real food_id. Kept alongside parseMealDraft the same way FoodController keeps
   * both /food/search and /food/:code - useful on its own, and parseMealDraft is built on top of it.
   * Auth-gated even though nothing here is account-scoped yet: every call costs real money, so
   * this can't be an open endpoint the way /food/search or /exercise are.
   */
  @Post("meal/parse-text")
  async parseMealText(@Body() body: unknown) {
    try {
      const { text } = aiParseMealTextRequestSchema.parse(body);
      return await this.ai.parseMealText(text);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw error;
    }
  }

  /**
   * Raw extraction + search-then-match against indb (ARCHITECTURE.md §5) - a confirmable draft,
   * never written to food_log directly. The client shows it for editing, then logs each resolved
   * item through the existing POST /food-log with source: "ai_text" - no new log-writing code.
   */
  @Post("meal/parse")
  async parseMealDraft(@Body() body: unknown) {
    try {
      const { text } = aiParseMealTextRequestSchema.parse(body);
      return await this.mealDraft.resolveDraft(text);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw error;
    }
  }
}
