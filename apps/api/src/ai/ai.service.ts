import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider, type RawMealItem } from "./ai-provider.interface.js";

@Injectable()
export class AiService {
  constructor(@Inject(AI_PROVIDER) private readonly provider: AiProvider) {}

  /**
   * Thin pass-through to the configured AiProvider for now - the home for per-account usage
   * logging/quota enforcement (app.ai_usage) once that roadmap item exists, same way other
   * services sit between a controller and whatever they depend on.
   */
  async parseMealText(text: string): Promise<RawMealItem[]> {
    return this.provider.parseMealText(text);
  }
}
