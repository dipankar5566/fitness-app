import {
  createFoodLogRequestSchema,
  onboardingRequestSchema,
  syncPullResponseSchema,
  syncPushRequestSchema,
  syncPushResponseSchema,
  type CreateFoodLogRequest,
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

const foodSearchResultSchema = z.object({
  food_id: z.number(),
  code: z.string(),
  name: z.string(),
  food_type: z.string(),
  score: z.number(),
});
export type FoodSearchResult = z.infer<typeof foodSearchResultSchema>;

export async function searchFoods(apiUrl: string, query: string): Promise<FoodSearchResult[]> {
  const response = await fetch(`${apiUrl}/food/search?q=${encodeURIComponent(query)}`);
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
});
export type FoodDetail = z.infer<typeof foodDetailSchema>;

export async function getFoodDetail(apiUrl: string, code: string): Promise<FoodDetail> {
  const response = await fetch(`${apiUrl}/food/${encodeURIComponent(code)}`);
  if (!response.ok) {
    throw new ApiError(`get food detail failed with status ${response.status}`);
  }
  return foodDetailSchema.parse(await response.json());
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
