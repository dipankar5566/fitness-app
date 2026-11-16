import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { AiUsageService } from "./ai-usage.service.js";

describe("AiUsageService", () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let service: AiUsageService;

  beforeEach(async () => {
    db = { query: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [AiUsageService, { provide: DatabaseService, useValue: db }],
    }).compile();
    service = moduleRef.get(AiUsageService);
  });

  describe("checkQuota", () => {
    it("does not throw when today's spend is below the quota", async () => {
      db.query.mockResolvedValue({ rows: [{ total: "0.02" }] });

      await expect(service.checkQuota("account-1")).resolves.toBeUndefined();
    });

    it("throws once today's spend is at or above the quota", async () => {
      db.query.mockResolvedValue({ rows: [{ total: "0.10" }] });

      await expect(service.checkQuota("account-1")).rejects.toThrow(/limit reached/i);
    });

    it("treats no usage rows yet as zero spend, not an error", async () => {
      db.query.mockResolvedValue({ rows: [{ total: null }] });

      await expect(service.checkQuota("account-1")).resolves.toBeUndefined();
    });
  });

  describe("record", () => {
    it("inserts a usage row with the given account, feature, tokens, and cost", async () => {
      db.query.mockResolvedValue({ rows: [] });

      await service.record("account-1", "meal_parse_text", 120, 40, 0.0001);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO app.ai_usage"),
        ["account-1", "meal_parse_text", 120, 40, 0.0001],
      );
    });
  });
});
