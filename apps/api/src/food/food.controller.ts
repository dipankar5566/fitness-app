import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

interface SearchFoodsRow {
  food_id: number;
  code: string;
  name: string;
  food_type: string;
  score: number;
}

@Controller("food")
export class FoodController {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Thin wrapper over indb.search_foods() (db/0001_indb.sql) - fuzzy name search across INDB recipes
   * and ingredients, already multilingual-ready via food_name (ARCHITECTURE.md section 6).
   */
  @Get("search")
  async search(@Query("q") q?: string, @Query("limit") limit?: string) {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException("Query parameter 'q' is required");
    }
    const result = await this.db.query<SearchFoodsRow>("SELECT * FROM search_foods($1, $2)", [
      q,
      limit ? Number(limit) : 20,
    ]);
    return result.rows;
  }
}
