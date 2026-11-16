import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { FoodLogModule } from "../food-log/food-log.module.js";
import { ProfileModule } from "../profile/profile.module.js";
import { CoachController } from "./coach.controller.js";
import { CoachService } from "./coach.service.js";

@Module({
  imports: [AuthModule, AiModule, ProfileModule, FoodLogModule],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
