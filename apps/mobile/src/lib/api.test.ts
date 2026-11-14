import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createGuestAccount, getProfile, submitOnboarding } from "./api";

describe("createGuestAccount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed session on success", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ accessToken: "t", accountId: "a" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await createGuestAccount("http://localhost:3001");

    expect(session).toEqual({ accessToken: "t", accountId: "a" });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/auth/guest", {
      method: "POST",
    });
  });

  it("throws ApiError when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(createGuestAccount("http://localhost:3001")).rejects.toThrow(ApiError);
  });
});

const PROFILE_ROW = {
  account_id: "a",
  sex: "male" as const,
  dob: "2000-01-15",
  height_cm: "175",
  activity_level: "moderate",
  diet_type: "veg",
};

const GOAL_ROW = {
  id: "g",
  account_id: "a",
  mode: "cut",
  target_kcal: "2100",
  target_protein_g: "150",
  target_carb_g: "200",
  target_fat_g: "60",
  training_day_adjustment_pct: "0.1",
  is_active: true,
};

describe("getProfile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the bearer token and returns the parsed profile/goal", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ profile: PROFILE_ROW, goal: GOAL_ROW }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getProfile("http://localhost:3001", "token-1");

    expect(result).toEqual({ profile: PROFILE_ROW, goal: GOAL_ROW });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/profile", {
      headers: { Authorization: "Bearer token-1" },
    });
  });

  it("throws ApiError when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 })),
    );

    await expect(getProfile("http://localhost:3001", "token-1")).rejects.toThrow(ApiError);
  });
});

describe("submitOnboarding", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const input = {
    sex: "male" as const,
    dob: "2000-01-15",
    heightCm: 175,
    activityLevel: "moderate" as const,
    dietType: "veg" as const,
    weightKg: 70,
    goalMode: "cut" as const,
  };

  it("PUTs the onboarding payload and returns the computed targets", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            profile: PROFILE_ROW,
            goal: GOAL_ROW,
            targets: { kcal: 2100, proteinG: 150, fatG: 60, carbG: 200 },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitOnboarding("http://localhost:3001", "token-1", input);

    expect(result.targets).toEqual({ kcal: 2100, proteinG: 150, fatG: 60, carbG: 200 });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-1" },
      body: JSON.stringify(input),
    });
  });

  it("throws ApiError when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 400 })),
    );

    await expect(submitOnboarding("http://localhost:3001", "token-1", input)).rejects.toThrow(
      ApiError,
    );
  });
});
