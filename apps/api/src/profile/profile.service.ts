import { Injectable } from "@nestjs/common";
import {
  calculateAgeYears,
  calculateMacroTargets,
  type ActivityLevel,
  type DietType,
  type GoalMode,
  type MacroTargets,
  type Sex,
} from "@fitness-app/shared";
import { DatabaseService } from "../database/database.service.js";

export interface OnboardingInput {
  sex: Sex;
  dob: string;
  heightCm: number;
  activityLevel: ActivityLevel;
  dietType: DietType;
  weightKg: number;
  goalMode: GoalMode;
}

interface ProfileRow {
  account_id: string;
  sex: Sex;
  dob: string;
  height_cm: string;
  activity_level: ActivityLevel;
  diet_type: DietType;
}

interface GoalRow {
  id: string;
  account_id: string;
  mode: GoalMode;
  target_kcal: string;
  target_protein_g: string;
  target_carb_g: string;
  target_fat_g: string;
  training_day_adjustment_pct: string;
  is_active: boolean;
}

@Injectable()
export class ProfileService {
  constructor(private readonly db: DatabaseService) {}

  async getProfile(
    accountId: string,
  ): Promise<{ profile: ProfileRow | null; goal: GoalRow | null }> {
    const [profileResult, goalResult] = await Promise.all([
      this.db.query<ProfileRow>("SELECT * FROM app.profile WHERE account_id = $1", [accountId]),
      this.db.query<GoalRow>(
        "SELECT * FROM app.goal WHERE account_id = $1 AND is_active LIMIT 1",
        [accountId],
      ),
    ]);
    return {
      profile: profileResult.rows[0] ?? null,
      goal: goalResult.rows[0] ?? null,
    };
  }

  /**
   * Onboarding (PRD section 5.1 / ARCHITECTURE.md): upserts the profile, records the starting
   * weight as a body_metric row, retires any previous goal, and stores freshly-computed targets.
   * Targets are computed for a rest day (ARCHITECTURE.md's training_day_adjustment_pct is applied
   * at read-time for training days once M3 adds workout-day detection).
   */
  async completeOnboarding(
    accountId: string,
    input: OnboardingInput,
  ): Promise<{ profile: ProfileRow; goal: GoalRow; targets: MacroTargets }> {
    const profileResult = await this.db.query<ProfileRow>(
      `INSERT INTO app.profile (account_id, sex, dob, height_cm, activity_level, diet_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (account_id) DO UPDATE SET
         sex = EXCLUDED.sex,
         dob = EXCLUDED.dob,
         height_cm = EXCLUDED.height_cm,
         activity_level = EXCLUDED.activity_level,
         diet_type = EXCLUDED.diet_type
       RETURNING *`,
      [accountId, input.sex, input.dob, input.heightCm, input.activityLevel, input.dietType],
    );

    await this.db.query(
      `INSERT INTO app.body_metric (id, account_id, metric_type, value, recorded_at)
       VALUES (uuid_generate_v4(), $1, 'weight_kg', $2, now())`,
      [accountId, input.weightKg],
    );

    const targets = calculateMacroTargets(
      {
        sex: input.sex,
        ageYears: calculateAgeYears(input.dob),
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        activityLevel: input.activityLevel,
      },
      input.goalMode,
      false,
    );

    await this.db.query(
      "UPDATE app.goal SET is_active = false WHERE account_id = $1 AND is_active",
      [accountId],
    );

    const goalResult = await this.db.query<GoalRow>(
      `INSERT INTO app.goal (account_id, mode, target_kcal, target_protein_g, target_carb_g, target_fat_g)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [accountId, input.goalMode, targets.kcal, targets.proteinG, targets.carbG, targets.fatG],
    );

    return { profile: profileResult.rows[0], goal: goalResult.rows[0], targets };
  }
}
