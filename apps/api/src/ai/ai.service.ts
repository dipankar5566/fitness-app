import { Inject, Injectable } from "@nestjs/common";
import {
  AI_PROVIDER,
  type AiProvider,
  type ChatMessage,
  type MealPlanRequest,
  type RawMealItem,
  type RawPlanItem,
} from "./ai-provider.interface.js";
import { AiUsageService } from "./ai-usage.service.js";

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly usage: AiUsageService,
  ) {}

  /**
   * Checks the daily quota before ever calling the provider - a blocked request costs nothing.
   * The provider itself records real per-call token usage after a successful response (it's the
   * only layer with the actual numbers), so usage.record lives there, not here.
   */
  async parseMealText(accountId: string, text: string): Promise<RawMealItem[]> {
    await this.usage.checkQuota(accountId);
    return this.provider.parseMealText(accountId, text);
  }

  async parseMealImage(accountId: string, image: Buffer, mimeType: string): Promise<RawMealItem[]> {
    await this.usage.checkQuota(accountId);
    return this.provider.parseMealImage(accountId, image, mimeType);
  }

  async chat(accountId: string, messages: ChatMessage[]): Promise<string> {
    await this.usage.checkQuota(accountId);
    return this.provider.chat(accountId, messages);
  }

  async generateMealPlan(accountId: string, request: MealPlanRequest): Promise<RawPlanItem[]> {
    await this.usage.checkQuota(accountId);
    return this.provider.generateMealPlan(accountId, request);
  }
}
