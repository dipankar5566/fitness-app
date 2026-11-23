import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { coachMessageRequestSchema } from "@fitness-app/shared";
import type { Request } from "express";
import { ZodError } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CoachService } from "./coach.service.js";

@Controller("coach")
@UseGuards(JwtAuthGuard)
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  @Post("message")
  async sendMessage(@Req() req: Request, @Body() body: unknown) {
    try {
      const { message } = coachMessageRequestSchema.parse(body);
      return await this.coach.sendMessage(req.accountId!, message);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw error;
    }
  }

  @Get("messages")
  async getHistory(@Req() req: Request) {
    return this.coach.getHistory(req.accountId!);
  }

  /** Cached once-a-day grounded insight for the Today screen; null before onboarding. */
  @Get("daily-insight")
  async dailyInsight(@Req() req: Request) {
    return this.coach.dailyInsight(req.accountId!);
  }
}
