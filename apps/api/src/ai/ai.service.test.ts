import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDER } from "./ai-provider.interface.js";
import { AiUsageService } from "./ai-usage.service.js";
import { AiService } from "./ai.service.js";

describe("AiService", () => {
  let provider: {
    parseMealText: ReturnType<typeof vi.fn>;
    parseMealImage: ReturnType<typeof vi.fn>;
    chat: ReturnType<typeof vi.fn>;
    generateMealPlan: ReturnType<typeof vi.fn>;
  };
  let usage: { checkQuota: ReturnType<typeof vi.fn> };
  let service: AiService;

  beforeEach(async () => {
    provider = { parseMealText: vi.fn(), parseMealImage: vi.fn(), chat: vi.fn(), generateMealPlan: vi.fn() };
    usage = { checkQuota: vi.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AI_PROVIDER, useValue: provider },
        { provide: AiUsageService, useValue: usage },
      ],
    }).compile();
    service = moduleRef.get(AiService);
  });

  it("checks the quota, then passes the text through to the configured provider", async () => {
    const items = [{ name: "roti", quantity: 2, unit: "piece" }];
    provider.parseMealText.mockResolvedValue(items);

    const result = await service.parseMealText("account-1", "2 roti aur dal");

    expect(usage.checkQuota).toHaveBeenCalledWith("account-1");
    expect(provider.parseMealText).toHaveBeenCalledWith("account-1", "2 roti aur dal");
    expect(result).toEqual(items);
  });

  it("checks the quota, then passes the image buffer and mime type through to the configured provider", async () => {
    const items = [{ name: "rice", quantity: 1, unit: "bowl" }];
    provider.parseMealImage.mockResolvedValue(items);
    const image = Buffer.from("fake-image-bytes");

    const result = await service.parseMealImage("account-1", image, "image/jpeg");

    expect(usage.checkQuota).toHaveBeenCalledWith("account-1");
    expect(provider.parseMealImage).toHaveBeenCalledWith("account-1", image, "image/jpeg");
    expect(result).toEqual(items);
  });

  it("never calls the provider when the quota check rejects", async () => {
    usage.checkQuota.mockRejectedValue(new Error("Daily AI usage limit reached. Try again tomorrow."));

    await expect(service.parseMealText("account-1", "2 roti")).rejects.toThrow(/limit reached/);

    expect(provider.parseMealText).not.toHaveBeenCalled();
  });

  it("checks the quota, then passes the chat messages through to the configured provider", async () => {
    provider.chat.mockResolvedValue("You're doing great, keep it up!");
    const messages = [
      { role: "system" as const, content: "You are a coach." },
      { role: "user" as const, content: "How am I doing?" },
    ];

    const result = await service.chat("account-1", messages);

    expect(usage.checkQuota).toHaveBeenCalledWith("account-1");
    expect(provider.chat).toHaveBeenCalledWith("account-1", messages);
    expect(result).toBe("You're doing great, keep it up!");
  });

  it("checks the quota before generating a meal plan, and skips the provider when it rejects", async () => {
    const request = {
      targetKcal: 2000,
      targetProteinG: 120,
      targetCarbG: 220,
      targetFatG: 60,
      dietType: "veg",
      mealBudgets: { breakfast: 500, lunch: 700, snack: 200, dinner: 600 },
    };
    provider.generateMealPlan.mockResolvedValue([{ mealType: "lunch", name: "Chapati", grams: 80 }]);

    await expect(service.generateMealPlan("account-1", request)).resolves.toHaveLength(1);
    expect(usage.checkQuota).toHaveBeenCalledWith("account-1");

    provider.generateMealPlan.mockClear();
    usage.checkQuota.mockRejectedValue(new Error("Daily AI usage limit reached. Try again tomorrow."));
    await expect(service.generateMealPlan("account-1", request)).rejects.toThrow(/limit reached/);
    expect(provider.generateMealPlan).not.toHaveBeenCalled();
  });
});
