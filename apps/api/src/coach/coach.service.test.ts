import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiService } from "../ai/ai.service.js";
import { DatabaseService } from "../database/database.service.js";
import { FoodLogService } from "../food-log/food-log.service.js";
import { ProfileService } from "../profile/profile.service.js";
import { CoachService } from "./coach.service.js";

describe("CoachService", () => {
  let ai: { chat: ReturnType<typeof vi.fn> };
  let profile: { getProfile: ReturnType<typeof vi.fn>; getLatestWeightKg: ReturnType<typeof vi.fn> };
  let foodLog: { listByDate: ReturnType<typeof vi.fn> };
  let db: { query: ReturnType<typeof vi.fn> };
  let service: CoachService;

  const onboardedProfile = {
    account_id: "account-1",
    sex: "male" as const,
    dob: "2000-01-15",
    height_cm: "175",
    activity_level: "moderate" as const,
    diet_type: "veg" as const,
  };
  const activeGoal = {
    id: "goal-1",
    account_id: "account-1",
    mode: "cut",
    target_kcal: "2200",
    target_protein_g: "150",
    target_carb_g: "200",
    target_fat_g: "70",
    training_day_adjustment_pct: "0",
    is_active: true,
  };

  beforeEach(async () => {
    ai = { chat: vi.fn() };
    profile = { getProfile: vi.fn(), getLatestWeightKg: vi.fn() };
    foodLog = { listByDate: vi.fn().mockResolvedValue([]) };
    db = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CoachService,
        { provide: AiService, useValue: ai },
        { provide: ProfileService, useValue: profile },
        { provide: FoodLogService, useValue: foodLog },
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();
    service = moduleRef.get(CoachService);
  });

  describe("sendMessage - ED-signal adversarial prompts", () => {
    it("short-circuits with the ED-signal response and never calls the model", async () => {
      const result = await service.sendMessage("account-1", "I've been starving myself for a week to lose weight");

      expect(result.reply).toMatch(/not alone/i);
      expect(ai.chat).not.toHaveBeenCalled();
      expect(profile.getProfile).not.toHaveBeenCalled();
    });

    it("still persists both the user message and the ED-signal reply", async () => {
      await service.sendMessage("account-1", "I want to purge after every meal");

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO app.chat_message"),
        expect.arrayContaining(["account-1", "user", "I want to purge after every meal"]),
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO app.chat_message"),
        expect.arrayContaining(["account-1", "assistant"]),
      );
    });
  });

  describe("sendMessage - grounded reply", () => {
    it("builds a system prompt from the user's targets/biometrics and passes history + the new message to the model", async () => {
      profile.getProfile.mockResolvedValue({ profile: onboardedProfile, goal: activeGoal });
      profile.getLatestWeightKg.mockResolvedValue(70);
      ai.chat.mockResolvedValue("You're on track - keep hitting that 2200 kcal target.");

      const result = await service.sendMessage("account-1", "How am I doing today?");

      expect(result.reply).toBe("You're on track - keep hitting that 2200 kcal target.");
      const [, messages] = ai.chat.mock.calls[0];
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("2200 kcal");
      expect(messages.at(-1)).toEqual({ role: "user", content: "How am I doing today?" });
    });

    it("works for a not-yet-onboarded account, with no biometrics in the prompt", async () => {
      profile.getProfile.mockResolvedValue({ profile: null, goal: null });
      profile.getLatestWeightKg.mockResolvedValue(null);
      ai.chat.mockResolvedValue("Let's get your profile set up first!");

      const result = await service.sendMessage("account-1", "What should I eat today?");

      expect(result.reply).toBe("Let's get your profile set up first!");
      const [, messages] = ai.chat.mock.calls[0];
      expect(messages[0].content).toContain("hasn't finished onboarding");
    });
  });

  describe("sendMessage - calorie-floor guardrail", () => {
    it("replaces a model reply that suggests a target below the safe floor", async () => {
      profile.getProfile.mockResolvedValue({ profile: onboardedProfile, goal: activeGoal });
      profile.getLatestWeightKg.mockResolvedValue(70);
      ai.chat.mockResolvedValue("Sure, try cutting down to just 900 kcal a day to speed things up.");

      const result = await service.sendMessage("account-1", "Can I lose weight faster?");

      expect(result.reply).not.toContain("900 kcal");
      expect(result.reply).toMatch(/can't recommend going below/i);
    });

    it("leaves a safe reply untouched", async () => {
      profile.getProfile.mockResolvedValue({ profile: onboardedProfile, goal: activeGoal });
      profile.getLatestWeightKg.mockResolvedValue(70);
      ai.chat.mockResolvedValue("Aim for about 2100 kcal today to stay on track.");

      const result = await service.sendMessage("account-1", "What should my target be today?");

      expect(result.reply).toBe("Aim for about 2100 kcal today to stay on track.");
    });
  });

  describe("sendMessage - medical-condition disclaimer", () => {
    it("appends the medical disclaimer when the user mentions a medical condition and the model didn't include one", async () => {
      profile.getProfile.mockResolvedValue({ profile: onboardedProfile, goal: activeGoal });
      profile.getLatestWeightKg.mockResolvedValue(70);
      ai.chat.mockResolvedValue("You could try lower-GI carbs to help manage that.");

      const result = await service.sendMessage("account-1", "I have type 2 diabetes, what carbs should I eat?");

      expect(result.reply).toContain("not a medical professional");
    });

    it("does not duplicate the disclaimer if the model already included it", async () => {
      profile.getProfile.mockResolvedValue({ profile: onboardedProfile, goal: activeGoal });
      profile.getLatestWeightKg.mockResolvedValue(70);
      ai.chat.mockResolvedValue(
        "I'm not a medical professional and can't diagnose or treat medical conditions - please check with a doctor for anything medical.",
      );

      const result = await service.sendMessage("account-1", "I have thyroid issues, any diet tips?");

      expect(result.reply.match(/not a medical professional/gi) ?? []).toHaveLength(1);
    });
  });

  describe("getHistory", () => {
    it("returns rows in chronological order", async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: "2", account_id: "account-1", role: "assistant", content: "second", created_at: new Date() },
          { id: "1", account_id: "account-1", role: "user", content: "first", created_at: new Date() },
        ],
      });

      const result = await service.getHistory("account-1");

      expect(result.map((row) => row.id)).toEqual(["1", "2"]);
    });
  });
});
