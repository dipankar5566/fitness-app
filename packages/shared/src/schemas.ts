/**
 * Shared Zod schemas for the sync protocol and core syncable entities — ARCHITECTURE.md §2-3.
 * Used by both apps/api (DTO validation) and apps/mobile (local SQLite row shape + request bodies).
 */
import { z } from "zod";

// Every syncable row shares this shape: client-generated id, soft delete, last-write-wins timestamp.
export const syncableBaseSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  isDeleted: z.boolean().default(false),
  updatedAt: z.string().datetime(),
});

export const foodSourceSchema = z.enum(["indb", "packaged", "custom"]);
export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const logSourceSchema = z.enum(["manual", "ai_text", "ai_photo", "barcode"]);

export const foodLogEntrySchema = syncableBaseSchema.extend({
  foodSource: foodSourceSchema,
  foodRef: z.string(), // indb.food.code | packaged_food.id | custom_food.id
  quantity: z.number().positive(),
  unit: z.string(), // "g" | "ml" | a serving_measure name
  mealType: mealTypeSchema,
  loggedAt: z.string().datetime(),
  source: logSourceSchema,
  isEstimate: z.boolean().default(false),
});
export type FoodLogEntry = z.infer<typeof foodLogEntrySchema>;

// POST /food-log request body - id is client-generated (architecture rule: syncable tables use a
// client-generated uuid, not a serial, so logging works offline); accountId/isDeleted/updatedAt
// are server-set, never trusted from the client.
export const createFoodLogRequestSchema = foodLogEntrySchema.omit({
  accountId: true,
  isDeleted: true,
  updatedAt: true,
});
export type CreateFoodLogRequest = z.infer<typeof createFoodLogRequestSchema>;

// PATCH /food-log/:id request body - only the fields a user can actually edit after logging.
export const updateFoodLogRequestSchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  mealType: mealTypeSchema.optional(),
  loggedAt: z.string().datetime().optional(),
});
export type UpdateFoodLogRequest = z.infer<typeof updateFoodLogRequestSchema>;

export const workoutSetSchema = syncableBaseSchema.extend({
  sessionId: z.string().uuid(),
  exerciseId: z.string(),
  setNo: z.number().int().positive(),
  reps: z.number().int().nonnegative(),
  weightKg: z.number().nonnegative(),
  rpe: z.number().min(1).max(10).optional(),
  isWarmup: z.boolean().default(false),
});
export type WorkoutSet = z.infer<typeof workoutSetSchema>;

export const workoutSessionSchema = syncableBaseSchema.extend({
  programDayId: z.string().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
});
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;

// Generic sync envelope — one push/pull protocol for every syncable table (ARCHITECTURE.md §3).
export const syncTableNameSchema = z.enum(["food_log", "workout_session", "workout_set", "body_metric"]);

export const syncPushRowSchema = z.object({
  table: syncTableNameSchema,
  op: z.enum(["upsert", "delete"]),
  row: z.record(z.string(), z.unknown()),
});
export type SyncPushRow = z.infer<typeof syncPushRowSchema>;

export const syncPushRequestSchema = z.object({
  syncToken: z.string().nullable(),
  rows: z.array(syncPushRowSchema),
});
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export const syncPullResponseSchema = z.object({
  changes: z.array(syncPushRowSchema),
  nextSyncToken: z.string(),
});
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;

// Profile / goal — PRD §5.1.
export const dietTypeSchema = z.enum(["veg", "eggetarian", "non_veg", "vegan", "jain"]);
export type DietType = z.infer<typeof dietTypeSchema>;
export const goalModeSchema = z.enum(["bulk", "cut", "recomp", "maintain"]);
export const activityLevelSchema = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);

export const profileSchema = z.object({
  accountId: z.string().uuid(),
  sex: z.enum(["male", "female"]),
  dob: z.string().date(),
  heightCm: z.number().positive(),
  activityLevel: activityLevelSchema,
  dietType: dietTypeSchema,
});
export type Profile = z.infer<typeof profileSchema>;

export const goalSchema = z.object({
  accountId: z.string().uuid(),
  mode: goalModeSchema,
  isActive: z.boolean().default(true),
});
export type Goal = z.infer<typeof goalSchema>;

// Onboarding request body - PUT /profile (ARCHITECTURE.md: profile + target calculation).
export const onboardingRequestSchema = z.object({
  sex: z.enum(["male", "female"]),
  dob: z.string().date(),
  heightCm: z.number().positive(),
  activityLevel: activityLevelSchema,
  dietType: dietTypeSchema,
  weightKg: z.number().positive(),
  goalMode: goalModeSchema,
});
export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;
