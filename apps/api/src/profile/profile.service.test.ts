import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { ProfileService } from "./profile.service.js";

describe("ProfileService", () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let service: ProfileService;

  beforeEach(async () => {
    db = { query: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [ProfileService, { provide: DatabaseService, useValue: db }],
    }).compile();
    service = moduleRef.get(ProfileService);
  });

  describe("getProfile", () => {
    it("returns null profile and goal when the account has not onboarded yet", async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await service.getProfile("account-1");

      expect(result).toEqual({ profile: null, goal: null });
    });
  });

  describe("completeOnboarding", () => {
    it("stores the profile, weight, and computed targets, retiring any previous goal", async () => {
      const profileRow = { account_id: "account-1", sex: "male", dob: "2000-01-15" };
      const goalRow = { id: "goal-1", account_id: "account-1", mode: "cut" };
      db.query
        .mockResolvedValueOnce({ rows: [profileRow] }) // INSERT profile
        .mockResolvedValueOnce({ rows: [] }) // INSERT body_metric
        .mockResolvedValueOnce({ rows: [] }) // UPDATE goal is_active = false
        .mockResolvedValueOnce({ rows: [goalRow] }); // INSERT goal

      const result = await service.completeOnboarding("account-1", {
        sex: "male",
        dob: "2000-01-15",
        heightCm: 175,
        activityLevel: "moderate",
        dietType: "veg",
        weightKg: 70,
        goalMode: "cut",
      });

      expect(result).toEqual({
        profile: profileRow,
        goal: goalRow,
        targets: expect.objectContaining({
          kcal: expect.any(Number),
          proteinG: expect.any(Number),
          fatG: expect.any(Number),
          carbG: expect.any(Number),
        }),
      });
      expect(db.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO app.profile"),
        ["account-1", "male", "2000-01-15", 175, "moderate", "veg"],
      );
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO app.body_metric"),
        ["account-1", 70],
      );
      expect(db.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("UPDATE app.goal SET is_active = false"),
        ["account-1"],
      );
      expect(db.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining("INSERT INTO app.goal"),
        expect.arrayContaining(["account-1", "cut"]),
      );
    });
  });
});
