import {
  mealPlanSchema,
  type MealPlan,
  coachMessageRequestSchema,
  createFoodLogRequestSchema,
  foodReportRequestSchema,
  onboardingRequestSchema,
  syncPullResponseSchema,
  syncPushRequestSchema,
  syncPushResponseSchema,
  type CreateFoodLogRequest,
  type DietType,
  type FoodReportRequest,
  type MealType,
  type OnboardingRequest,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
} from "@fitness-app/shared";
import { z } from "zod";

const guestAuthResponseSchema = z.object({
  accessToken: z.string(),
  accountId: z.string(),
});

export type GuestAuthResponse = z.infer<typeof guestAuthResponseSchema>;

export class ApiError extends Error {}

/** The AI daily-quota guard (apps/api/src/ai/ai-usage.service.ts) rejects with 403 - distinct from
 * a generic ApiError so the coach screen can show "daily limit reached" instead of a bare error. */
export class AiQuotaExceededError extends ApiError {}

/** A `fetch` rejection with no server response (offline, DNS failure, timeout) - as opposed to an
 * `ApiError` (server responded, just not with 2xx) or a `ZodError` (server responded with a bad shape). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

/** Calls POST /auth/guest on the API (guest-first auth - CLAUDE.md "Architecture rules"). */
export async function createGuestAccount(apiUrl: string): Promise<GuestAuthResponse> {
  const response = await fetch(`${apiUrl}/auth/guest`, { method: "POST" });
  if (!response.ok) {
    throw new ApiError(`guest auth failed with status ${response.status}`);
  }
  return guestAuthResponseSchema.parse(await response.json());
}

// Mirrors the API's actual response shape (raw app.profile/app.goal rows), not the camelCase
// domain schemas in packages/shared - those describe the sync/domain model, not this endpoint's JSON.
const macroTargetsSchema = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  fatG: z.number(),
  carbG: z.number(),
});

const profileRowSchema = z.object({
  account_id: z.string(),
  sex: z.enum(["male", "female"]),
  dob: z.string(),
  height_cm: z.string(),
  activity_level: z.string(),
  diet_type: z.string(),
});

const goalRowSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  mode: z.string(),
  target_kcal: z.string(),
  target_protein_g: z.string(),
  target_carb_g: z.string(),
  target_fat_g: z.string(),
  training_day_adjustment_pct: z.string(),
  is_active: z.boolean(),
});

const getProfileResponseSchema = z.object({
  profile: profileRowSchema.nullable(),
  goal: goalRowSchema.nullable(),
});
export type GetProfileResponse = z.infer<typeof getProfileResponseSchema>;

const onboardingResponseSchema = z.object({
  profile: profileRowSchema,
  goal: goalRowSchema,
  targets: macroTargetsSchema,
});
export type OnboardingResponse = z.infer<typeof onboardingResponseSchema>;

export async function getProfile(apiUrl: string, accessToken: string): Promise<GetProfileResponse> {
  const response = await fetch(`${apiUrl}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new ApiError(`get profile failed with status ${response.status}`);
  }
  return getProfileResponseSchema.parse(await response.json());
}

export async function submitOnboarding(
  apiUrl: string,
  accessToken: string,
  input: OnboardingRequest,
): Promise<OnboardingResponse> {
  const response = await fetch(`${apiUrl}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(onboardingRequestSchema.parse(input)),
  });
  if (!response.ok) {
    throw new ApiError(`onboarding failed with status ${response.status}`);
  }
  return onboardingResponseSchema.parse(await response.json());
}

const dietClassSchema = z.enum(["vegan", "veg", "egg", "non_veg"]).nullable();

const foodSearchResultSchema = z.object({
  food_id: z.number(),
  code: z.string(),
  name: z.string(),
  food_type: z.string(),
  score: z.number(),
  dietClass: dietClassSchema,
});
export type FoodSearchResult = z.infer<typeof foodSearchResultSchema>;

export async function searchFoods(
  apiUrl: string,
  query: string,
  dietType?: DietType,
): Promise<FoodSearchResult[]> {
  const dietTypeParam = dietType ? `&dietType=${encodeURIComponent(dietType)}` : "";
  const response = await fetch(`${apiUrl}/food/search?q=${encodeURIComponent(query)}${dietTypeParam}`);
  if (!response.ok) {
    throw new ApiError(`food search failed with status ${response.status}`);
  }
  return z.array(foodSearchResultSchema).parse(await response.json());
}

const foodDetailSchema = z.object({
  code: z.string(),
  name: z.string(),
  foodType: z.string(),
  nutrientsPer100g: z.object({
    kcal: z.number().nullable(),
    proteinG: z.number().nullable(),
    fatG: z.number().nullable(),
    carbG: z.number().nullable(),
    fibreG: z.number().nullable(),
  }),
  servingMeasures: z.array(
    z.object({ name: z.string(), grams: z.number().nullable(), isDefault: z.boolean() }),
  ),
  dietClass: dietClassSchema,
  jainOk: z.boolean().nullable(),
});
export type FoodDetail = z.infer<typeof foodDetailSchema>;

/** "What to log next" for a meal - top meal-relevant foods (GET /food/suggestions, open like
 * search). Same row shape as searchFoods. */
export async function getSuggestions(
  apiUrl: string,
  mealType: MealType,
  dietType?: DietType,
  limit = 6,
): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({ mealType, limit: String(limit) });
  if (dietType) {
    params.set("dietType", dietType);
  }
  const response = await fetch(`${apiUrl}/food/suggestions?${params.toString()}`);
  if (!response.ok) {
    throw new ApiError(`food suggestions failed with status ${response.status}`);
  }
  return z.array(foodSearchResultSchema).parse(await response.json());
}

export async function getFoodDetail(apiUrl: string, code: string): Promise<FoodDetail> {
  const response = await fetch(`${apiUrl}/food/${encodeURIComponent(code)}`);
  if (!response.ok) {
    throw new ApiError(`get food detail failed with status ${response.status}`);
  }
  return foodDetailSchema.parse(await response.json());
}

const foodReportResponseSchema = z.object({ id: z.string() });

/** Submits a "can't find it" / "numbers look wrong" report (POST /food/report, auth-gated). */
export async function reportFood(
  apiUrl: string,
  accessToken: string,
  input: FoodReportRequest,
): Promise<{ id: string }> {
  const response = await fetch(`${apiUrl}/food/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(foodReportRequestSchema.parse(input)),
  });
  if (!response.ok) {
    throw new ApiError(`food report failed with status ${response.status}`);
  }
  return foodReportResponseSchema.parse(await response.json());
}

const macroBreakdownSchema = z.object({
  kcal: z.number().nullable(),
  proteinG: z.number().nullable(),
  fatG: z.number().nullable(),
  carbG: z.number().nullable(),
});

const foodLogEntryRowSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  food_source: z.string(),
  food_ref: z.string(),
  quantity: z.string(),
  unit: z.string(),
  meal_type: z.string(),
  logged_at: z.string(),
  source: z.string(),
  is_estimate: z.boolean(),
  macros: macroBreakdownSchema.nullable().optional(),
  food_name: z.string().nullable().optional(),
});
export type FoodLogEntryRow = z.infer<typeof foodLogEntryRowSchema>;

export async function createFoodLog(
  apiUrl: string,
  accessToken: string,
  input: CreateFoodLogRequest,
): Promise<FoodLogEntryRow> {
  const response = await fetch(`${apiUrl}/food-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(createFoodLogRequestSchema.parse(input)),
  });
  if (!response.ok) {
    throw new ApiError(`create food log failed with status ${response.status}`);
  }
  return foodLogEntryRowSchema.parse(await response.json());
}

export async function listFoodLog(
  apiUrl: string,
  accessToken: string,
  date: string,
): Promise<FoodLogEntryRow[]> {
  const response = await fetch(`${apiUrl}/food-log?date=${encodeURIComponent(date)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new ApiError(`list food log failed with status ${response.status}`);
  }
  return z.array(foodLogEntryRowSchema).parse(await response.json());
}

export async function deleteFoodLog(
  apiUrl: string,
  accessToken: string,
  id: string,
): Promise<void> {
  const response = await fetch(`${apiUrl}/food-log/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new ApiError(`delete food log failed with status ${response.status}`);
  }
}

const exerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()),
  equipment: z.string().nullable(),
  instructions: z.array(z.string()),
  imageUrls: z.array(z.string()),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export async function searchExercises(
  apiUrl: string,
  filter: { muscle?: string; equipment?: string } = {},
): Promise<Exercise[]> {
  const params = new URLSearchParams();
  if (filter.muscle) params.set("muscle", filter.muscle);
  if (filter.equipment) params.set("equipment", filter.equipment);
  const query = params.toString();
  const response = await fetch(`${apiUrl}/exercise${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new ApiError(`exercise search failed with status ${response.status}`);
  }
  return z.array(exerciseSchema).parse(await response.json());
}

const programExerciseSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  position: z.number(),
  targetSets: z.number(),
  targetReps: z.string().nullable(),
});
export type ProgramExercise = z.infer<typeof programExerciseSchema>;

const programDaySchema = z.object({
  id: z.string(),
  dayIndex: z.number(),
  name: z.string(),
  exercises: z.array(programExerciseSchema),
});
export type ProgramDay = z.infer<typeof programDaySchema>;

const programSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  days: z.array(programDaySchema),
});
export type Program = z.infer<typeof programSchema>;

/** Built-in program library (PRD section 5.4) - no auth, same as searchExercises. */
export async function listPrograms(apiUrl: string): Promise<Program[]> {
  const response = await fetch(`${apiUrl}/program`);
  if (!response.ok) {
    throw new ApiError(`list programs failed with status ${response.status}`);
  }
  return z.array(programSchema).parse(await response.json());
}

const mealDraftItemSchema = z.object({
  rawName: z.string(),
  rawQuantity: z.number(),
  rawUnit: z.string(),
  foodSource: z.literal("indb").nullable(),
  foodRef: z.string().nullable(),
  foodName: z.string().nullable(),
  quantity: z.number(),
  unit: z.string(),
  isEstimate: z.boolean(),
});
export type MealDraftItem = z.infer<typeof mealDraftItemSchema>;

/** AI meal-text parse -> search-then-match draft (ARCHITECTURE.md §5). Never writes to food_log
 * itself - the screen shows this for editing, then logs each resolved item via createFoodLog. */
export async function parseMealDraft(
  apiUrl: string,
  accessToken: string,
  text: string,
): Promise<MealDraftItem[]> {
  const response = await fetch(`${apiUrl}/ai/meal/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new ApiError(`meal parse failed with status ${response.status}`);
  }
  return z.array(mealDraftItemSchema).parse(await response.json());
}

/** Same draft shape as parseMealDraft, from a single meal photo (PRD section 5.5). React
 * Native's standard multipart-upload idiom: a {uri, name, type} object appended to FormData,
 * matching what expo-image-picker's ImagePickerAsset gives the caller - no Content-Type header
 * here, fetch sets the multipart boundary itself from the FormData body. */
export async function parseMealPhoto(
  apiUrl: string,
  accessToken: string,
  photo: { uri: string; name: string; type: string },
): Promise<MealDraftItem[]> {
  const formData = new FormData();
  // React Native's FormData.append accepts this file-object shape; the DOM FormData type doesn't
  // model it, hence the cast - this is the standard RN idiom, not a workaround for a bug.
  formData.append("photo", photo as unknown as Blob);
  const response = await fetch(`${apiUrl}/ai/meal/parse-photo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!response.ok) {
    throw new ApiError(`meal photo parse failed with status ${response.status}`);
  }
  return z.array(mealDraftItemSchema).parse(await response.json());
}

const packagedFoodNutrientsSchema = z.object({
  energy_kcal: z.number().nullable(),
  protein_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  carb_g: z.number().nullable(),
  fibre_g: z.number().nullable(),
});

const packagedFoodDetailSchema = z.object({
  id: z.string(),
  barcode: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  nutrientsPer100g: packagedFoodNutrientsSchema,
});
export type PackagedFoodDetail = z.infer<typeof packagedFoodDetailSchema>;

/** Barcode scan -> Open Food Facts lookup (PRD section 5.5). Null means genuinely not found
 * (the 404 case) - the screen shows a "not found, add it" flow for that, not an error; any other
 * failure still throws ApiError like every other lookup here. */
export async function lookupPackagedFood(apiUrl: string, barcode: string): Promise<PackagedFoodDetail | null> {
  const response = await fetch(`${apiUrl}/packaged-food/${encodeURIComponent(barcode)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError(`packaged food lookup failed with status ${response.status}`);
  }
  return packagedFoodDetailSchema.parse(await response.json());
}

export async function pushSync(
  apiUrl: string,
  accessToken: string,
  request: SyncPushRequest,
): Promise<SyncPushResponse> {
  const response = await fetch(`${apiUrl}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(syncPushRequestSchema.parse(request)),
  });
  if (!response.ok) {
    throw new ApiError(`sync push failed with status ${response.status}`);
  }
  return syncPushResponseSchema.parse(await response.json());
}

export async function pullSync(
  apiUrl: string,
  accessToken: string,
  since: string | null,
): Promise<SyncPullResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  const response = await fetch(`${apiUrl}/sync${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new ApiError(`sync pull failed with status ${response.status}`);
  }
  return syncPullResponseSchema.parse(await response.json());
}

const coachMessageResponseSchema = z.object({ reply: z.string() });

/** One coach-chat turn (PRD §5.5/ARCHITECTURE.md §5). The server holds the conversation history
 * and grounding data (CoachService.sendMessage) - the client only ever sends the new message
 * text. A 403 means the account hit its daily AI quota (AiUsageService) - surfaced as a distinct
 * error type so the screen can show a specific message instead of a generic failure. */
export async function sendCoachMessage(
  apiUrl: string,
  accessToken: string,
  message: string,
): Promise<string> {
  const response = await fetch(`${apiUrl}/coach/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(coachMessageRequestSchema.parse({ message })),
  });
  if (response.status === 403) {
    throw new AiQuotaExceededError("coach message failed: daily AI quota exceeded");
  }
  if (!response.ok) {
    throw new ApiError(`coach message failed with status ${response.status}`);
  }
  return coachMessageResponseSchema.parse(await response.json()).reply;
}

const coachMessageRowSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string(),
  created_at: z.string(),
});
export type CoachMessageRow = z.infer<typeof coachMessageRowSchema>;

/** Full chat history (CoachService.getHistory - last CHAT_HISTORY_LIMIT turns), oldest first. */
export async function getCoachHistory(apiUrl: string, accessToken: string): Promise<CoachMessageRow[]> {
  const response = await fetch(`${apiUrl}/coach/messages`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new ApiError(`coach history failed with status ${response.status}`);
  }
  return z.array(coachMessageRowSchema).parse(await response.json());
}

/** Cached once-a-day grounded insight for the Today screen. Returns null before onboarding (server
 * sends an empty body) or on a 403 quota cap - the card simply isn't shown in those cases. */
export async function getCoachDailyInsight(apiUrl: string, accessToken: string): Promise<string | null> {
  const response = await fetch(`${apiUrl}/coach/daily-insight`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 403) {
    return null; // daily AI quota reached - just omit the insight
  }
  if (!response.ok) {
    throw new ApiError(`coach daily insight failed with status ${response.status}`);
  }
  const text = await response.text();
  if (!text) {
    return null; // not onboarded yet
  }
  const parsed = z.object({ insight: z.string() }).nullable().parse(JSON.parse(text));
  return parsed?.insight ?? null;
}

const mealPlanResponseSchema = z.object({ plan: mealPlanSchema.nullable() });

/** Today's cached AI meal plan (GET /meal-plan/today) - never triggers generation. */
export async function getTodayMealPlan(apiUrl: string, accessToken: string): Promise<MealPlan | null> {
  const response = await fetch(`${apiUrl}/meal-plan/today`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw new ApiError(`get meal plan failed with status ${response.status}`);
  }
  return mealPlanResponseSchema.parse(await response.json()).plan;
}

/** Thrown when the server can't produce a plan that meets the account's targets (422), or refuses a
 * target below the safe calorie floor - `message` is the server's own user-facing explanation. */
export class MealPlanUnavailableError extends ApiError {}

/** POST /meal-plan/generate - returns today's cached plan or generates one. 403 = daily AI quota. */
export async function generateMealPlan(apiUrl: string, accessToken: string): Promise<MealPlan> {
  const response = await fetch(`${apiUrl}/meal-plan/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 403) {
    throw new AiQuotaExceededError("meal plan failed: daily AI quota exceeded");
  }
  if (response.status === 422 || response.status === 400) {
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    throw new MealPlanUnavailableError(
      typeof body?.message === "string" ? body.message : "Couldn't build a meal plan right now.",
    );
  }
  if (!response.ok) {
    throw new ApiError(`generate meal plan failed with status ${response.status}`);
  }
  const plan = mealPlanResponseSchema.parse(await response.json()).plan;
  if (!plan) {
    throw new ApiError("generate meal plan returned no plan");
  }
  return plan;
}
