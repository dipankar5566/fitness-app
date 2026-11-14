import { BadRequestException, Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { onboardingRequestSchema } from "@fitness-app/shared";
import type { Request } from "express";
import { ZodError } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ProfileService } from "./profile.service.js";

@Controller("profile")
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  getProfile(@Req() req: Request) {
    return this.profile.getProfile(req.accountId!);
  }

  @Put()
  completeOnboarding(@Req() req: Request, @Body() body: unknown) {
    try {
      const input = onboardingRequestSchema.parse(body);
      return this.profile.completeOnboarding(req.accountId!, input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw error;
    }
  }
}
