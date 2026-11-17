import { afterEach, describe, expect, it, vi } from "vitest";

// Three native/RN modules can't load outside a React Native/Expo runtime under Vitest (confirmed
// directly: react-native's own entry point uses Flow syntax Vite's transform can't parse, and
// both expo-crypto and react-native-health-connect transitively import expo's own module
// registry) - all three are mocked the same way reminders.test.ts mocks expo-notifications.
// body-metric-repo/sync-engine are mocked too so importHcWeights's tests don't need a real
// SqlDb or network call - they're plain TS modules, not native ones, mocked purely for isolation.
const rnMock = vi.hoisted(() => ({ Platform: { OS: "android" as string } }));
vi.mock("react-native", () => rnMock);

const hcLibMock = vi.hoisted(() => ({
  getSdkStatus: vi.fn(),
  initialize: vi.fn(),
  getGrantedPermissions: vi.fn(),
  requestPermission: vi.fn(),
  readRecords: vi.fn(),
  insertRecords: vi.fn(),
  SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 },
  ExerciseType: { STRENGTH_TRAINING: 70 },
}));
vi.mock("react-native-health-connect", () => hcLibMock);

const cryptoMock = vi.hoisted(() => ({
  digestStringAsync: vi.fn(),
  CryptoDigestAlgorithm: { SHA1: "SHA-1" },
}));
vi.mock("expo-crypto", () => cryptoMock);

const bodyMetricRepoMock = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("./body-metric-repo", () => bodyMetricRepoMock);

const syncEngineMock = vi.hoisted(() => ({ syncNow: vi.fn() }));
vi.mock("./sync-engine", () => syncEngineMock);

import {
  extractWeightReading,
  getHcStatus,
  hasHcPermissions,
  importHcWeights,
  mapSessionToHcExercisePayload,
  parseHcSettings,
  readRecentExerciseSessions,
  readTodaySteps,
  requestHcPermissions,
  stableIdForHcWeight,
  toBodyMetricWeightRow,
  writeWorkoutToHc,
} from "./health-connect";

describe("parseHcSettings", () => {
  it("falls back to everything off for null (nothing saved yet)", () => {
    expect(parseHcSettings(null)).toEqual({ steps: false, exercise: false, weight: false, writeWorkout: false });
  });

  it("falls back to everything off for malformed JSON", () => {
    expect(parseHcSettings("{not valid")).toEqual({ steps: false, exercise: false, weight: false, writeWorkout: false });
  });

  it("round-trips a saved settings object, coercing missing fields to false", () => {
    expect(parseHcSettings(JSON.stringify({ steps: true, weight: true }))).toEqual({
      steps: true,
      exercise: false,
      weight: true,
      writeWorkout: false,
    });
  });
});

describe("extractWeightReading", () => {
  it("extracts the id/value/time from a Health Connect weight record", () => {
    const result = extractWeightReading({
      metadata: { id: "hc-1" },
      weight: { inKilograms: 72.5 },
      time: "2026-11-17T06:00:00.000Z",
    });
    expect(result).toEqual({ hcRecordId: "hc-1", valueKg: 72.5, recordedAtIso: "2026-11-17T06:00:00.000Z" });
  });

  it("returns null when the record has no Health Connect id (can't dedupe safely)", () => {
    const result = extractWeightReading({ weight: { inKilograms: 72.5 }, time: "2026-11-17T06:00:00.000Z" });
    expect(result).toBeNull();
  });
});

describe("toBodyMetricWeightRow", () => {
  it("builds a weight_kg body_metric row from a reading", () => {
    const row = toBodyMetricWeightRow("row-id", "account-1", {
      hcRecordId: "hc-1",
      valueKg: 72.5,
      recordedAtIso: "2026-11-17T06:00:00.000Z",
    });
    expect(row).toMatchObject({
      id: "row-id",
      accountId: "account-1",
      metricType: "weight_kg",
      value: 72.5,
      photoRef: null,
      recordedAt: "2026-11-17T06:00:00.000Z",
      isDeleted: false,
    });
    expect(() => new Date(row.updatedAt).toISOString()).not.toThrow();
  });
});

describe("mapSessionToHcExercisePayload", () => {
  it("maps a local session into a strength-training ExerciseSession payload", () => {
    const payload = mapSessionToHcExercisePayload({
      startedAt: "2026-11-17T08:00:00.000Z",
      endedAt: "2026-11-17T09:00:00.000Z",
    });
    expect(payload).toEqual({
      recordType: "ExerciseSession",
      exerciseType: 70,
      startTime: "2026-11-17T08:00:00.000Z",
      endTime: "2026-11-17T09:00:00.000Z",
      title: "Workout",
    });
  });
});

describe("stableIdForHcWeight", () => {
  afterEach(() => vi.clearAllMocks());

  it("formats the digest as a UUID-shaped string", async () => {
    cryptoMock.digestStringAsync.mockResolvedValue("0123456789abcdef0123456789abcdef01234567");

    const id = await stableIdForHcWeight("hc-1");

    expect(id).toBe("01234567-89ab-cdef-0123-456789abcdef");
    expect(cryptoMock.digestStringAsync).toHaveBeenCalledWith("SHA-1", "hc-weight:hc-1");
  });

  it("is deterministic for the same input", async () => {
    cryptoMock.digestStringAsync.mockResolvedValue("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

    const first = await stableIdForHcWeight("hc-1");
    const second = await stableIdForHcWeight("hc-1");

    expect(first).toBe(second);
  });
});

describe("getHcStatus", () => {
  afterEach(() => {
    vi.clearAllMocks();
    rnMock.Platform.OS = "android";
  });

  it("returns unsupported_platform off Android, without calling the native SDK", async () => {
    rnMock.Platform.OS = "ios";

    expect(await getHcStatus()).toBe("unsupported_platform");
    expect(hcLibMock.getSdkStatus).not.toHaveBeenCalled();
  });

  it("maps SDK_AVAILABLE to 'available'", async () => {
    hcLibMock.getSdkStatus.mockResolvedValue(3);
    expect(await getHcStatus()).toBe("available");
  });

  it("maps SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED to 'update_required'", async () => {
    hcLibMock.getSdkStatus.mockResolvedValue(2);
    expect(await getHcStatus()).toBe("update_required");
  });

  it("maps anything else to 'unavailable'", async () => {
    hcLibMock.getSdkStatus.mockResolvedValue(1);
    expect(await getHcStatus()).toBe("unavailable");
  });
});

describe("hasHcPermissions / requestHcPermissions", () => {
  afterEach(() => {
    vi.clearAllMocks();
    rnMock.Platform.OS = "android";
  });

  it("hasHcPermissions is true only when every requested kind is granted", async () => {
    hcLibMock.getGrantedPermissions.mockResolvedValue([{ accessType: "read", recordType: "Steps" }]);

    expect(await hasHcPermissions(["steps"])).toBe(true);
    expect(await hasHcPermissions(["steps", "weight"])).toBe(false);
  });

  it("requestHcPermissions initializes, requests the mapped permissions, and reports what's granted", async () => {
    hcLibMock.getGrantedPermissions.mockResolvedValue([{ accessType: "read", recordType: "Weight" }]);

    const granted = await requestHcPermissions(["weight"]);

    expect(hcLibMock.initialize).toHaveBeenCalledTimes(1);
    expect(hcLibMock.requestPermission).toHaveBeenCalledWith([{ accessType: "read", recordType: "Weight" }]);
    expect(granted).toBe(true);
  });

  it("is false off Android without calling anything native", async () => {
    rnMock.Platform.OS = "ios";
    expect(await requestHcPermissions(["weight"])).toBe(false);
    expect(hcLibMock.initialize).not.toHaveBeenCalled();
  });
});

describe("readTodaySteps", () => {
  afterEach(() => {
    vi.clearAllMocks();
    rnMock.Platform.OS = "android";
  });

  it("sums the count across every returned Steps record", async () => {
    hcLibMock.readRecords.mockResolvedValue({ records: [{ count: 1000 }, { count: 500 }] });

    expect(await readTodaySteps()).toBe(1500);
    expect(hcLibMock.readRecords).toHaveBeenCalledWith(
      "Steps",
      expect.objectContaining({
        timeRangeFilter: expect.objectContaining({ operator: "between", startTime: expect.any(String), endTime: expect.any(String) }),
      }),
    );
  });

  it("returns 0 off Android", async () => {
    rnMock.Platform.OS = "ios";
    expect(await readTodaySteps()).toBe(0);
    expect(hcLibMock.readRecords).not.toHaveBeenCalled();
  });
});

describe("readRecentExerciseSessions", () => {
  afterEach(() => vi.clearAllMocks());

  it("maps and sorts sessions most-recent-first", async () => {
    hcLibMock.readRecords.mockResolvedValue({
      records: [
        { metadata: { id: "a" }, title: "Leg day", startTime: "2026-11-15T08:00:00.000Z", endTime: "2026-11-15T09:00:00.000Z" },
        { metadata: { id: "b" }, title: "Push day", startTime: "2026-11-17T08:00:00.000Z", endTime: "2026-11-17T09:00:00.000Z" },
      ],
    });

    const result = await readRecentExerciseSessions(7);

    expect(result.map((s) => s.title)).toEqual(["Push day", "Leg day"]);
  });
});

describe("importHcWeights", () => {
  afterEach(() => {
    vi.clearAllMocks();
    rnMock.Platform.OS = "android";
  });

  it("imports every reading with a Health Connect id, skips readings without one, then syncs once", async () => {
    hcLibMock.readRecords.mockResolvedValue({
      records: [
        { metadata: { id: "hc-1" }, weight: { inKilograms: 72.5 }, time: "2026-11-17T06:00:00.000Z" },
        { weight: { inKilograms: 73 }, time: "2026-11-16T06:00:00.000Z" }, // no metadata.id - skipped
      ],
    });
    cryptoMock.digestStringAsync.mockResolvedValue("0123456789abcdef0123456789abcdef01234567");

    const imported = await importHcWeights({} as never, "http://api", "token", "account-1", "2026-11-01T00:00:00.000Z");

    expect(imported).toBe(1);
    expect(bodyMetricRepoMock.insert).toHaveBeenCalledTimes(1);
    expect(syncEngineMock.syncNow).toHaveBeenCalledTimes(1);
  });

  it("doesn't sync when nothing new was imported", async () => {
    hcLibMock.readRecords.mockResolvedValue({ records: [] });

    const imported = await importHcWeights({} as never, "http://api", "token", "account-1", "2026-11-01T00:00:00.000Z");

    expect(imported).toBe(0);
    expect(syncEngineMock.syncNow).not.toHaveBeenCalled();
  });
});

describe("writeWorkoutToHc", () => {
  afterEach(() => {
    vi.clearAllMocks();
    rnMock.Platform.OS = "android";
  });

  it("inserts the mapped exercise-session record", async () => {
    await writeWorkoutToHc({ startedAt: "2026-11-17T08:00:00.000Z", endedAt: "2026-11-17T09:00:00.000Z" });

    expect(hcLibMock.insertRecords).toHaveBeenCalledWith([
      { recordType: "ExerciseSession", exerciseType: 70, startTime: "2026-11-17T08:00:00.000Z", endTime: "2026-11-17T09:00:00.000Z", title: "Workout" },
    ]);
  });

  it("does nothing off Android", async () => {
    rnMock.Platform.OS = "ios";
    await writeWorkoutToHc({ startedAt: "2026-11-17T08:00:00.000Z", endedAt: "2026-11-17T09:00:00.000Z" });
    expect(hcLibMock.insertRecords).not.toHaveBeenCalled();
  });
});
