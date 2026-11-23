import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { MealPlanService } from "./meal-plan.service.js";

/** Auth-gated like the other AI endpoints - generation costs real money (AiUsageService quota). */
@Controller("meal-plan")
@UseGuards(JwtAuthGuard)
export class MealPlanController {
  constructor(private readonly mealPlan: MealPlanService) {}

  /** Today's cached plan, if one was generated - never calls the model. */
  @Get("today")
  async today(@Req() req: Request) {
    return { plan: await this.mealPlan.getToday(req.accountId!) };
  }

  /** Returns today's cached plan, or generates (and caches) one. */
  @Post("generate")
  async generate(@Req() req: Request) {
    return { plan: await this.mealPlan.generate(req.accountId!) };
  }
}
