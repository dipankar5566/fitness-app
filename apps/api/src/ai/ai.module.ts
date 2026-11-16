import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AI_PROVIDER } from "./ai-provider.interface.js";
import { AiController } from "./ai.controller.js";
import { AiService } from "./ai.service.js";
import { OpenAiProvider } from "./openai-provider.js";

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [AiService, { provide: AI_PROVIDER, useClass: OpenAiProvider }],
})
export class AiModule {}
