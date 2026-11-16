import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./ai/ai.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CoachModule } from "./coach/coach.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { ExerciseModule } from "./exercise/exercise.module.js";
import { FoodLogModule } from "./food-log/food-log.module.js";
import { FoodModule } from "./food/food.module.js";
import { HealthController } from "./health/health.controller.js";
import { PackagedFoodModule } from "./packaged-food/packaged-food.module.js";
import { ProfileModule } from "./profile/profile.module.js";
import { ProgramModule } from "./program/program.module.js";
import { SyncModule } from "./sync/sync.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AiModule,
    AuthModule,
    CoachModule,
    ExerciseModule,
    FoodModule,
    PackagedFoodModule,
    ProfileModule,
    ProgramModule,
    FoodLogModule,
    SyncModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
