import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { dietTypeSchema } from "@fitness-app/shared";
import { ZodError } from "zod";
import { FoodService } from "./food.service.js";

@Controller("food")
export class FoodController {
  constructor(private readonly food: FoodService) {}

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
