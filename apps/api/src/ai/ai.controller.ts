import { BadRequestException, Body, Controller, Post, UseGuards } from "@nestjs/common";
import { aiParseMealTextRequestSchema } from "@fitness-app/shared";
import { ZodError } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { AiService } from "./ai.service.js";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  /**
   * Raw extraction only - names/quantities/units as the model read them from the text, not yet
   * resolved to a real food_id (that's the next roadmap item: draft -> confirm -> log).
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
}
