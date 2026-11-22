import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { dietTypeSchema, foodReportRequestSchema } from "@fitness-app/shared";
import type { Request } from "express";
import { ZodError } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { FoodService } from "./food.service.js";

@Controller("food")
export class FoodController {
  constructor(private readonly food: FoodService) {}

  /**
   * Report a missing or wrong food. Auth-gated (unlike search/detail, which are open reference
   * data) so every report is attributable to an account for review. The report is stored only;
   * nothing is synced back to the client.
   */
  @Post("report")
  @UseGuards(JwtAuthGuard)
  report(@Req() req: Request, @Body() body: unknown) {
    try {
      const input = foodReportRequestSchema.parse(body);
      return this.food.reportFood(req.accountId!, input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw error;
    }
  }

  /**
   * Thin wrapper over indb.search_foods() (db/0001_indb.sql) - fuzzy name search across INDB recipes
   * and ingredients, already multilingual-ready via food_name (ARCHITECTURE.md section 6).
   * `dietType` (optional) filters to foods allowed for that diet - see FoodService.search's docstring.
   */
  @Get("search")
  async search(
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("dietType") dietType?: string,
  ) {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException("Query parameter 'q' is required");
    }
    try {
      const parsedDietType = dietType ? dietTypeSchema.parse(dietType) : undefined;
      return this.food.search(q, limit ? Number(limit) : 20, parsedDietType);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.issues);
      }
      throw error;
    }
  }

  /** Per-100g macros + serving measures - what a log-meal screen needs to show real nutrition. */
  @Get(":code")
  async getDetail(@Param("code") code: string) {
    const detail = await this.food.getDetail(code);
    if (!detail) {
      throw new NotFoundException(`No food with code '${code}'`);
    }
    return detail;
  }
}
