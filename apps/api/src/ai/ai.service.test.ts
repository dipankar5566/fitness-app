import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDER } from "./ai-provider.interface.js";
import { AiService } from "./ai.service.js";

describe("AiService", () => {
  let provider: { parseMealText: ReturnType<typeof vi.fn>; parseMealImage: ReturnType<typeof vi.fn> };
  let service: AiService;

  beforeEach(async () => {
    provider = { parseMealText: vi.fn(), parseMealImage: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [AiService, { provide: AI_PROVIDER, useValue: provider }],
    }).compile();
    service = moduleRef.get(AiService);
  });

  it("passes the text through to the configured provider and returns its result", async () => {
    const items = [{ name: "roti", quantity: 2, unit: "piece" }];
    provider.parseMealText.mockResolvedValue(items);

    const result = await service.parseMealText("2 roti aur dal");

    expect(provider.parseMealText).toHaveBeenCalledWith("2 roti aur dal");
    expect(result).toEqual(items);
  });

  it("passes the image buffer and mime type through to the configured provider", async () => {
    const items = [{ name: "rice", quantity: 1, unit: "bowl" }];
    provider.parseMealImage.mockResolvedValue(items);
    const image = Buffer.from("fake-image-bytes");

    const result = await service.parseMealImage(image, "image/jpeg");

    expect(provider.parseMealImage).toHaveBeenCalledWith(image, "image/jpeg");
    expect(result).toEqual(items);
  });
});
