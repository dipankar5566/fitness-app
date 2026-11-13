import { Module } from "@nestjs/common";
import { FoodController } from "./food.controller.js";

@Module({
  controllers: [FoodController],
})
export class FoodModule {}
