import { Module } from "@nestjs/common";
import { PackagedFoodController } from "./packaged-food.controller.js";
import { PackagedFoodService } from "./packaged-food.service.js";

@Module({
  controllers: [PackagedFoodController],
  providers: [PackagedFoodService],
  exports: [PackagedFoodService],
})
export class PackagedFoodModule {}
