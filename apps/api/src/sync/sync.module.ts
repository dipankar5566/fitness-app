import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { FoodModule } from "../food/food.module.js";
import { SyncController } from "./sync.controller.js";
import { SyncService } from "./sync.service.js";

@Module({
  imports: [AuthModule, FoodModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
