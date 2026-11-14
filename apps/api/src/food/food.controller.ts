import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { FoodService } from "./food.service.js";

@Controller("food")
export class FoodController {
  constructor(private readonly food: FoodService) {}

  /**
   * Thin wrapper over indb.search_foods() (db/0001_indb.sql) - fuzzy name search across INDB recipes
   * and ingredients, already multilingual-ready via food_name (ARCHITECTURE.md section 6).
   */
  @Get("search")
  async search(@Query("q") q?: string, @Query("limit") limit?: string) {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException("Query parameter 'q' is required");
    }
    return this.food.search(q, limit ? Number(limit) : 20);
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
