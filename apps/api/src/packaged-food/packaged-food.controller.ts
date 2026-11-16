import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { PackagedFoodService } from "./packaged-food.service.js";

@Controller("packaged-food")
export class PackagedFoodController {
  constructor(private readonly packagedFood: PackagedFoodService) {}

  /**
   * Barcode scan -> Open Food Facts lookup (PRD section 5.5). No auth guard: like /food/search
   * and /exercise, this is a reference-data lookup with no per-account cost (unlike the AI
   * endpoints, Open Food Facts is free to call).
   */
  @Get(":barcode")
  async getByBarcode(@Param("barcode") barcode: string) {
    const result = await this.packagedFood.lookupByBarcode(barcode);
    if (!result) {
      throw new NotFoundException(`No product found for barcode '${barcode}'`);
    }
    return result;
  }
}
