import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { FoodModule } from "../food/food.module.js";
import { ProfileModule } from "../profile/profile.module.js";
import { MealPlanController } from "./meal-plan.controller.js";
import { MealPlanService } from "./meal-plan.service.js";

@Module({
  imports: [AuthModule, AiModule, FoodModule, ProfileModule],
  controllers: [MealPlanController],
  providers: [MealPlanService],
})
export class MealPlanModule {}
