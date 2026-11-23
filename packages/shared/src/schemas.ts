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
export type MealType = z.infer<typeof mealTypeSchema>;
export const logSourceSchema = z.enum(["manual", "ai_text", "ai_photo", "barcode"]);
export type LogSource = z.infer<typeof logSourceSchema>;

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

// POST /food/report body - a user telling us a food is missing from search, or that an existing
// food's numbers look wrong. Not a syncable entity (see 0008_food_report.sql); server sets the
// account, status and timestamp. 'missing' needs the search query; 'wrong_nutrients' needs the
// food code being flagged.
export const foodReportKindSchema = z.enum(["missing", "wrong_nutrients"]);
export type FoodReportKind = z.infer<typeof foodReportKindSchema>;

export const foodReportRequestSchema = z
  .object({
    kind: foodReportKindSchema,
    query: z.string().trim().min(1).max(200).optional(),
    foodRef: z.string().trim().min(1).max(64).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.kind !== "missing" || Boolean(value.query), {
    message: "query is required for a 'missing' report",
    path: ["query"],
  })
  .refine((value) => value.kind !== "wrong_nutrients" || Boolean(value.foodRef), {
    message: "foodRef is required for a 'wrong_nutrients' report",
    path: ["foodRef"],
  });
export type FoodReportRequest = z.infer<typeof foodReportRequestSchema>;

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

export const customFoodSchema = syncableBaseSchema.extend({
  name: z.string().min(1),
});
export type CustomFood = z.infer<typeof customFoodSchema>;

export const customFoodIngredientSchema = syncableBaseSchema.extend({
  customFoodId: z.string().uuid(),
  foodSource: foodSourceSchema,
  foodRef: z.string(),
  quantityG: z.number().positive(),
});
export type CustomFoodIngredient = z.infer<typeof customFoodIngredientSchema>;

// Body metrics (weight/measurements/photo, PRD §5.6) — app.body_metric's existing CHECK constraint
// (0002_app_schema.sql). `value` is optional since a 'photo' row has no numeric value, and
// `photoRef` likewise since a weight/measurement row has no photo - exactly one is populated in
// practice, mirroring the nullable columns rather than a stricter discriminated union, since the
// server doesn't enforce that pairing either.
export const bodyMetricTypeSchema = z.enum(["weight_kg", "waist_cm", "chest_cm", "arm_cm", "photo"]);
export type BodyMetricType = z.infer<typeof bodyMetricTypeSchema>;

export const bodyMetricSchema = syncableBaseSchema.extend({
  metricType: bodyMetricTypeSchema,
  value: z.number().optional(),
  photoRef: z.string().optional(),
  recordedAt: z.string().datetime(),
});
export type BodyMetric = z.infer<typeof bodyMetricSchema>;

// Water intake (0009_water_log.sql) — one syncable row per drink event (amount in ml at a time).
export const waterLogSchema = syncableBaseSchema.extend({
  amountMl: z.number().positive(),
  recordedAt: z.string().datetime(),
});
export type WaterLog = z.infer<typeof waterLogSchema>;

// Intermittent fasting (0011_fasting_log.sql) — one syncable row per fast; endedAt absent while
// active. targetMinutes bounds mirror the table's CHECK (12h-23h, no multi-day fasts).
export const FASTING_MIN_TARGET_MINUTES = 720;
export const FASTING_MAX_TARGET_MINUTES = 1380;
export const fastingLogSchema = syncableBaseSchema.extend({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  targetMinutes: z.number().int().min(FASTING_MIN_TARGET_MINUTES).max(FASTING_MAX_TARGET_MINUTES),
});
export type FastingLog = z.infer<typeof fastingLogSchema>;

// Generic sync envelope — one push/pull protocol for every syncable table (ARCHITECTURE.md §3).
export const syncTableNameSchema = z.enum([
  "food_log",
  "custom_food",
  "custom_food_ingredient",
  "workout_session",
  "workout_set",
  "body_metric",
  "water_log",
  "fasting_log",
]);
export type SyncTableName = z.infer<typeof syncTableNameSchema>;

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

export const syncRejectReasonSchema = z.enum(["not_owner", "stale", "invalid"]);
export type SyncRejectReason = z.infer<typeof syncRejectReasonSchema>;

export const syncPushResponseSchema = z.object({
  applied: z.array(z.string()),
  rejected: z.array(z.object({ id: z.string(), reason: syncRejectReasonSchema })),
});
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;

export const syncPullResponseSchema = z.object({
  changes: z.array(syncPushRowSchema),
  nextSyncToken: z.string(),
});
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;

// Exercise library — PRD §5.4. Fixed value sets from free-exercise-db (db/import-exercises.ts),
// not an open free-text field — lets both apps/api (query validation) and apps/mobile (filter chips)
// share one enum instead of each hand-maintaining the same list.
export const exerciseMuscleSchema = z.enum([
  "abdominals",
  "abductors",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower back",
  "middle back",
  "neck",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
]);
export type ExerciseMuscle = z.infer<typeof exerciseMuscleSchema>;

export const exerciseEquipmentSchema = z.enum([
  "bands",
  "barbell",
  "body only",
  "cable",
  "dumbbell",
  "e-z curl bar",
  "exercise ball",
  "foam roll",
  "kettlebells",
  "machine",
  "medicine ball",
  "other",
]);
export type ExerciseEquipment = z.infer<typeof exerciseEquipmentSchema>;

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

// AI meal-text parsing — PRD §5.5/ARCHITECTURE.md §5 (AI gateway). The gateway only extracts raw
// food mentions + quantities from text (English/Hinglish) - it never resolves them to our own
// food_id itself, so the response is a draft the app shows for confirmation before any food_log
// write (ARCHITECTURE.md §5: "the gateway never writes to food_log directly").
export const aiParseMealTextRequestSchema = z.object({
  text: z.string().min(1),
});
export type AiParseMealTextRequest = z.infer<typeof aiParseMealTextRequestSchema>;

// AI coach chat — PRD §5.5/ARCHITECTURE.md §5, M5. One user message per request; the server holds
// the conversation history (app.chat_message) and grounding data, so the client only ever sends
// the new message text.
export const coachMessageRequestSchema = z.object({
  message: z.string().min(1),
});
export type CoachMessageRequest = z.infer<typeof coachMessageRequestSchema>;
