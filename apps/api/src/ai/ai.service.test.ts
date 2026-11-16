import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDER } from "./ai-provider.interface.js";
import { AiUsageService } from "./ai-usage.service.js";
import { AiService } from "./ai.service.js";

describe("AiService", () => {
  let provider: { parseMealText: ReturnType<typeof vi.fn>; parseMealImage: ReturnType<typeof vi.fn> };
  let usage: { checkQuota: ReturnType<typeof vi.fn> };
  let service: AiService;

  beforeEach(async () => {
    provider = { parseMealText: vi.fn(), parseMealImage: vi.fn() };
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
});
