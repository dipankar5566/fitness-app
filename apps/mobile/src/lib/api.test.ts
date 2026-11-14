import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createFoodLog,
  createGuestAccount,
  deleteFoodLog,
  getFoodDetail,
  getProfile,
  listFoodLog,
  searchFoods,
  submitOnboarding,
} from "./api";

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

describe("searchFoods", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("URL-encodes the query and returns the parsed results", async () => {
    const results = [{ food_id: 1, code: "ASC144", name: "Idli", food_type: "recipe", score: 1 }];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(results), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const found = await searchFoods("http://localhost:3001", "idli sambar");

    expect(found).toEqual(results);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/food/search?q=idli%20sambar");
  });

  it("throws ApiError when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(searchFoods("http://localhost:3001", "idli")).rejects.toThrow(ApiError);
  });
});

describe("getFoodDetail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const detail = {
    code: "ASC144",
    name: "Idli",
    foodType: "recipe",
    nutrientsPer100g: { kcal: 137, proteinG: 4.6, fatG: 0.3, carbG: 28.2, fibreG: 2.3 },
    servingMeasures: [{ name: "idli", grams: 25, isDefault: true }],
  };

  it("returns the parsed food detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(detail), { status: 200 })),
    );

    expect(await getFoodDetail("http://localhost:3001", "ASC144")).toEqual(detail);
  });

  it("throws ApiError on a 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );

    await expect(getFoodDetail("http://localhost:3001", "missing")).rejects.toThrow(ApiError);
  });
});

describe("food-log client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const entry = {
    id: "log-1",
    account_id: "a",
    food_source: "indb",
    food_ref: "ASC144",
    quantity: "2",
    unit: "idli",
    meal_type: "breakfast",
    logged_at: "2026-11-14T06:00:00.000Z",
    source: "manual",
    is_estimate: false,
    macros: { kcal: 68.8, proteinG: 2.3, fatG: 0.2, carbG: 14.1 },
  };

  const createInput = {
    id: "11111111-1111-4111-8111-111111111111",
    foodSource: "indb" as const,
    foodRef: "ASC144",
    quantity: 2,
    unit: "idli",
    mealType: "breakfast" as const,
    loggedAt: "2026-11-14T06:00:00.000Z",
    source: "manual" as const,
    isEstimate: false,
  };

  it("createFoodLog POSTs the entry and returns the parsed row", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(entry), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createFoodLog("http://localhost:3001", "token-1", createInput);

    expect(result).toEqual(entry);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/food-log", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-1" },
      body: JSON.stringify(createInput),
    });
  });

  it("listFoodLog GETs entries for a date with the bearer token", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([entry]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listFoodLog("http://localhost:3001", "token-1", "2026-11-14");

    expect(result).toEqual([entry]);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/food-log?date=2026-11-14", {
      headers: { Authorization: "Bearer token-1" },
    });
  });

  it("deleteFoodLog DELETEs by id", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteFoodLog("http://localhost:3001", "token-1", "log-1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/food-log/log-1", {
      method: "DELETE",
      headers: { Authorization: "Bearer token-1" },
    });
  });

  it("throws ApiError when a food-log request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 403 })),
    );

    await expect(deleteFoodLog("http://localhost:3001", "token-1", "log-1")).rejects.toThrow(
      ApiError,
    );
  });
});
