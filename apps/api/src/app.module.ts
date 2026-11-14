import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { FoodLogModule } from "./food-log/food-log.module.js";
import { FoodModule } from "./food/food.module.js";
import { HealthController } from "./health/health.controller.js";
import { ProfileModule } from "./profile/profile.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    FoodModule,
    ProfileModule,
    FoodLogModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
