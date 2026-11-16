import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createFoodLog,
  createGuestAccount,
  deleteFoodLog,
  getFoodDetail,
  getProfile,
  isNetworkError,
  listFoodLog,
  listPrograms,
  lookupPackagedFood,
  parseMealDraft,
  parseMealPhoto,
  pullSync,
  pushSync,
  searchExercises,
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
    const results = [
      { food_id: 1, code: "ASC144", name: "Idli", food_type: "recipe", score: 1, dietClass: "vegan" },
    ];
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

describe("searchExercises", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("with no filter, calls the endpoint with no query string", async () => {
    const results = [
      {
        id: "Bench_Press",
        name: "Bench Press",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["triceps"],
        equipment: "barbell",
        instructions: ["Lie down.", "Press up."],
        imageUrls: ["https://cdn.jsdelivr.net/gh/x/0.jpg"],
      },
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(results), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const found = await searchExercises("http://localhost:3001");

    expect(found).toEqual(results);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/exercise");
  });

  it("builds a query string from muscle and equipment filters", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await searchExercises("http://localhost:3001", { muscle: "chest", equipment: "barbell" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/exercise?muscle=chest&equipment=barbell",
    );
  });

  it("throws ApiError when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(searchExercises("http://localhost:3001")).rejects.toThrow(ApiError);
  });
});

describe("listPrograms", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches /program and returns the parsed, nested programs", async () => {
    const programs = [
      {
        id: "program-1",
        name: "Push / Pull / Legs",
        description: "3-day split",
        days: [
          {
            id: "day-1",
            dayIndex: 0,
            name: "Push",
            exercises: [
              { exerciseId: "Barbell_Bench_Press_-_Medium_Grip", exerciseName: "Barbell Bench Press", position: 0, targetSets: 4, targetReps: "6-10" },
            ],
          },
        ],
      },
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(programs), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const found = await listPrograms("http://localhost:3001");

    expect(found).toEqual(programs);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/program");
  });

  it("throws ApiError when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(listPrograms("http://localhost:3001")).rejects.toThrow(ApiError);
  });
});

describe("parseMealDraft", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the text with auth and returns the parsed draft items", async () => {
    const draft = [
      {
        rawName: "roti",
        rawQuantity: 2,
        rawUnit: "piece",
        foodSource: "indb",
        foodRef: "ASC096",
        foodName: "Chapati/Roti",
        quantity: 2,
        unit: "piece",
        isEstimate: false,
      },
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(draft), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const found = await parseMealDraft("http://localhost:3001", "token-1", "2 roti");

    expect(found).toEqual(draft);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/ai/meal/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-1" },
      body: JSON.stringify({ text: "2 roti" }),
    });
  });

  it("throws ApiError when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(parseMealDraft("http://localhost:3001", "token-1", "2 roti")).rejects.toThrow(ApiError);
  });
});

describe("parseMealPhoto", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the photo as multipart form data with auth and returns the parsed draft", async () => {
    const draft = [
      {
        rawName: "paratha",
        rawQuantity: 2,
        rawUnit: "piece",
        foodSource: "indb",
        foodRef: "ASC103",
        foodName: "Pea parantha/paratha",
        quantity: 2,
        unit: "piece",
        isEstimate: true,
      },
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(draft), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const found = await parseMealPhoto("http://localhost:3001", "token-1", {
      uri: "file:///meal.jpg",
      name: "meal.jpg",
      type: "image/jpeg",
    });

    expect(found).toEqual(draft);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/ai/meal/parse-photo");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer token-1" });
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("throws ApiError when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(
      parseMealPhoto("http://localhost:3001", "token-1", { uri: "file:///x.jpg", name: "x.jpg", type: "image/jpeg" }),
    ).rejects.toThrow(ApiError);
  });
});

describe("lookupPackagedFood", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches /packaged-food/:barcode and returns the parsed product", async () => {
    const product = {
      id: "pf-1",
      barcode: "5449000054227",
      name: "Coca-Cola Original Taste",
      brand: "Coca-Cola",
      nutrientsPer100g: { energy_kcal: 42, protein_g: 0, fat_g: 0, carb_g: 10.6, fibre_g: 0 },
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(product), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const found = await lookupPackagedFood("http://localhost:3001", "5449000054227");

    expect(found).toEqual(product);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/packaged-food/5449000054227");
  });

  it("returns null (not an error) when the barcode isn't found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );

    const found = await lookupPackagedFood("http://localhost:3001", "0000000000000");

    expect(found).toBeNull();
  });

  it("throws ApiError for any other failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(lookupPackagedFood("http://localhost:3001", "123")).rejects.toThrow(ApiError);
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
    dietClass: "vegan",
    jainOk: null,
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

describe("sync client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pushSync POSTs the envelope and returns the parsed applied/rejected lists", async () => {
    const response = { applied: ["a"], rejected: [] };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = {
      syncToken: null,
      rows: [
        {
          table: "food_log" as const,
          op: "upsert" as const,
          row: { id: "a" },
        },
      ],
    };
    const result = await pushSync("http://localhost:3001", "token-1", request);

    expect(result).toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-1" },
      body: JSON.stringify(request),
    });
  });

  it("pullSync GETs with the since token and returns the parsed changes", async () => {
    const response = { changes: [], nextSyncToken: "2026-11-15T00:00:00.000Z" };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pullSync("http://localhost:3001", "token-1", "2026-11-14T00:00:00.000Z");

    expect(result).toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/sync?since=2026-11-14T00%3A00%3A00.000Z",
      { headers: { Authorization: "Bearer token-1" } },
    );
  });

  it("pullSync omits the query string when there is no token yet", async () => {
    const response = { changes: [], nextSyncToken: "2026-11-15T00:00:00.000Z" };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await pullSync("http://localhost:3001", "token-1", null);

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/sync", {
      headers: { Authorization: "Bearer token-1" },
    });
  });

  it("throws ApiError when a sync request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(pullSync("http://localhost:3001", "token-1", null)).rejects.toThrow(ApiError);
  });
});

describe("isNetworkError", () => {
  it("is true for a TypeError (what fetch rejects with when offline)", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("is false for an ApiError (server responded, just not with 2xx)", () => {
    expect(isNetworkError(new ApiError("get profile failed with status 401"))).toBe(false);
  });
});
