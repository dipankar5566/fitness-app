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
