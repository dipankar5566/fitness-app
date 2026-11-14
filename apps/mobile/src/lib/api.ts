import { onboardingRequestSchema, type OnboardingRequest } from "@fitness-app/shared";
import { z } from "zod";

const guestAuthResponseSchema = z.object({
  accessToken: z.string(),
  accountId: z.string(),
});

export type GuestAuthResponse = z.infer<typeof guestAuthResponseSchema>;

export class ApiError extends Error {}

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
