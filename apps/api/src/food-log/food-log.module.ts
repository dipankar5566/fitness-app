import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { FoodModule } from "../food/food.module.js";
import { PackagedFoodModule } from "../packaged-food/packaged-food.module.js";
import { FoodLogController } from "./food-log.controller.js";
import { FoodLogService } from "./food-log.service.js";

@Module({
  imports: [AuthModule, FoodModule, PackagedFoodModule],
  controllers: [FoodLogController],
  providers: [FoodLogService],
  exports: [FoodLogService],
})
export class FoodLogModule {}
