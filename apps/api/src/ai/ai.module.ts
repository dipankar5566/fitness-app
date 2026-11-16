import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { FoodModule } from "../food/food.module.js";
import { AiMealDraftService } from "./ai-meal-draft.service.js";
import { AI_PROVIDER } from "./ai-provider.interface.js";
import { AiController } from "./ai.controller.js";
import { AiService } from "./ai.service.js";
import { OpenAiProvider } from "./openai-provider.js";

@Module({
  imports: [AuthModule, FoodModule],
  controllers: [AiController],
  providers: [AiService, AiMealDraftService, { provide: AI_PROVIDER, useClass: OpenAiProvider }],
})
export class AiModule {}
