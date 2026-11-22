import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { FoodController } from "./food.controller.js";
import { FoodService } from "./food.service.js";

@Module({
  imports: [AuthModule],
  controllers: [FoodController],
  providers: [FoodService],
  exports: [FoodService],
})
export class FoodModule {}
