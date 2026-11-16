import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { aiParseMealTextRequestSchema } from "@fitness-app/shared";
import { memoryStorage } from "multer";
import { ZodError } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { AiMealDraftService } from "./ai-meal-draft.service.js";
import { AiService } from "./ai.service.js";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // one meal photo; generous enough for a phone camera shot

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

  /**
   * Same draft shape as parseMealDraft, but search-then-matched from a single meal photo instead
   * of text (PRD section 5.5, "photo-based meal parse"). Every returned item is is_estimate - see
   * AiMealDraftService.resolveDraftFromImage's docstring for why that's forced regardless of match.
   */
  @Post("meal/parse-photo")
  @UseInterceptors(FileInterceptor("photo", { storage: memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES } }))
  async parseMealPhoto(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Missing 'photo' file");
    }
    if (!file.mimetype.startsWith("image/")) {
      throw new BadRequestException("File must be an image");
    }
    return this.mealDraft.resolveDraftFromImage(file.buffer, file.mimetype);
  }
}
