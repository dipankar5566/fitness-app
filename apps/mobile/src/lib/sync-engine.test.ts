import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDirty as getDirtyBodyMetrics, getLatest, insert as insertBodyMetric, type LocalBodyMetric } from "./body-metric-repo";
import { getDirtyCustomFoods, insertCustomFood, listCustomFoods, type LocalCustomFood } from "./custom-food-repo";
import { getDirty as getDirtyFasting, listRecent as listRecentFasts, start as startFast } from "./fasting-repo";
import { getDirty, insert, listByLocalDay, type LocalFoodLogRow } from "./food-log-repo";
import { getKv } from "./kv-store";
import { createTestDb } from "./node-sqlite-test-db";
import type { SqlDb } from "./sql-db";
import {
  getActiveSession,
  getDirtySessions,
  getDirtySets,
  insertSession,
  insertSet,
  listSetsForSession,
  type LocalWorkoutSession,
  type LocalWorkoutSet,
} from "./workout-repo";

vi.mock("./analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("./api", () => ({
  pushSync: vi.fn(),
  pullSync: vi.fn(),
  isNetworkError: (error: unknown) => error instanceof TypeError,
}));

const ROW: LocalFoodLogRow = {
  id: "11111111-1111-1111-1111-111111111111",
  accountId: "account-1",
  foodSource: "indb",
  foodRef: "L002",
  quantity: 150,
  unit: "g",
  mealType: "lunch",
  loggedAt: "2026-11-14T12:00:00.000Z",
  source: "manual",
  isEstimate: false,
  isDeleted: false,
  updatedAt: "2026-11-14T12:00:00.000Z",
  macros: { kcal: 195, proteinG: 4, fatG: 0.5, carbG: 42 },
  foodName: "Idli",
};

describe("sync-engine", () => {
  let db: SqlDb;

  beforeEach(async () => {
    db = await createTestDb();
    vi.resetAllMocks();
  });

  it("pushes dirty rows, marks the applied ones clean, then pulls and stores the new token", async () => {
    const { pushSync, pullSync } = await import("./api");
    (pushSync as ReturnType<typeof vi.fn>).mockResolvedValue({ applied: [ROW.id], rejected: [] });
    (pullSync as ReturnType<typeof vi.fn>).mockResolvedValue({
      changes: [
        {
          table: "food_log",
          op: "upsert",
          row: {
            id: "22222222-2222-2222-2222-222222222222",
            accountId: "account-1",
            isDeleted: false,
            updatedAt: "2026-11-14T13:00:00.000Z",
            foodSource: "indb",
            foodRef: "L003",
            quantity: 100,
            unit: "g",
            mealType: "dinner",
            loggedAt: "2026-11-14T13:00:00.000Z",
            source: "manual",
            isEstimate: false,
            macros: null,
            foodName: "Dal",
          },
        },
      ],
      nextSyncToken: "2026-11-14T13:00:00.000Z",
    });
    await insert(db, ROW);

    const { syncNow } = await import("./sync-engine");
    await syncNow(db, "http://localhost:3001", "token-1");

    expect(await getDirty(db)).toEqual([]); // the pushed row was marked clean
    const entries = await listByLocalDay(db, "account-1", "2026-11-14");
    expect(entries.map((e) => e.id)).toContain(ROW.id);
    const pulled = entries.find((e) => e.foodRef === "L003");
    expect(pulled?.foodName).toBe("Dal"); // the pulled row's name was applied
    expect(await getKv(db, "sync_token")).toBe("2026-11-14T13:00:00.000Z");
  });

  it("does not push when there is nothing dirty", async () => {
    const { pushSync, pullSync } = await import("./api");
    (pullSync as ReturnType<typeof vi.fn>).mockResolvedValue({ changes: [], nextSyncToken: "t1" });

    const { syncNow } = await import("./sync-engine");
    await syncNow(db, "http://localhost:3001", "token-1");

    expect(pushSync).not.toHaveBeenCalled();
  });

  it("leaves a row dirty when the server rejects it", async () => {
    const { pushSync, pullSync } = await import("./api");
    (pushSync as ReturnType<typeof vi.fn>).mockResolvedValue({
      applied: [],
      rejected: [{ id: ROW.id, reason: "stale" }],
    });
    (pullSync as ReturnType<typeof vi.fn>).mockResolvedValue({ changes: [], nextSyncToken: "t1" });
    await insert(db, ROW);

    const { syncNow } = await import("./sync-engine");
    await syncNow(db, "http://localhost:3001", "token-1");

    expect((await getDirty(db)).map((row) => row.id)).toEqual([ROW.id]);
  });

  it("swallows a network error instead of throwing, and leaves rows dirty", async () => {
    const { pushSync } = await import("./api");
    (pushSync as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("Failed to fetch"));
    await insert(db, ROW);

    const { syncNow } = await import("./sync-engine");
    await expect(syncNow(db, "http://localhost:3001", "token-1")).resolves.toBeUndefined();

    expect((await getDirty(db)).map((row) => row.id)).toEqual([ROW.id]);
  });

  it("pushes dirty rows across tables in one call, and routes a pulled custom_food change to its own repo", async () => {
    const { pushSync, pullSync } = await import("./api");
    const customFood: LocalCustomFood = {
      id: "33333333-3333-3333-3333-333333333333",
      accountId: "account-1",
      name: "Overnight oats",
      isDeleted: false,
      updatedAt: "2026-11-16T12:00:00.000Z",
    };
    (pushSync as ReturnType<typeof vi.fn>).mockResolvedValue({
      applied: [ROW.id, customFood.id],
      rejected: [],
    });
    (pullSync as ReturnType<typeof vi.fn>).mockResolvedValue({
      changes: [
        {
          table: "custom_food",
          op: "upsert",
          row: {
            id: "44444444-4444-4444-4444-444444444444",
            accountId: "account-1",
            isDeleted: false,
            updatedAt: "2026-11-16T13:00:00.000Z",
            name: "Pulled from another device",
          },
        },
      ],
      nextSyncToken: "2026-11-16T13:00:00.000Z",
    });
    await insert(db, ROW);
    await insertCustomFood(db, customFood);

    const { syncNow } = await import("./sync-engine");
    await syncNow(db, "http://localhost:3001", "token-1");

    expect(pushSync).toHaveBeenCalledWith(
      "http://localhost:3001",
      "token-1",
      expect.objectContaining({
        rows: expect.arrayContaining([
          expect.objectContaining({ table: "food_log" }),
          expect.objectContaining({ table: "custom_food" }),
        ]),
      }),
    );
    expect(await getDirty(db)).toEqual([]);
    expect(await getDirtyCustomFoods(db)).toEqual([]);
    const customFoods = await listCustomFoods(db, "account-1");
    expect(customFoods.map((f) => f.name)).toContain("Pulled from another device");
  });

  it("pushes a session and set, ordering the session before the set, and applies a pulled session end", async () => {
    const { pushSync, pullSync } = await import("./api");
    const session: LocalWorkoutSession = {
      id: "55555555-5555-5555-5555-555555555555",
      accountId: "account-1",
      programDayId: null,
      startedAt: "2026-11-16T08:00:00.000Z",
      endedAt: null,
      isDeleted: false,
      updatedAt: "2026-11-16T08:00:00.000Z",
    };
    const set: LocalWorkoutSet = {
      id: "66666666-6666-6666-6666-666666666666",
      accountId: "account-1",
      sessionId: session.id,
      exerciseId: "Bench_Press",
      exerciseName: "Bench Press",
      setNo: 1,
      reps: 8,
      weightKg: 60,
      rpe: null,
      isWarmup: false,
      isDeleted: false,
      updatedAt: "2026-11-16T08:05:00.000Z",
    };
    (pushSync as ReturnType<typeof vi.fn>).mockResolvedValue({ applied: [session.id, set.id], rejected: [] });
    (pullSync as ReturnType<typeof vi.fn>).mockResolvedValue({
      changes: [
        {
          table: "workout_session",
          op: "upsert",
          row: { ...session, endedAt: "2026-11-16T09:00:00.000Z", updatedAt: "2026-11-16T09:00:00.000Z" },
        },
      ],
      nextSyncToken: "2026-11-16T09:00:00.000Z",
    });
    await insertSession(db, session);
    await insertSet(db, set);

    const { syncNow } = await import("./sync-engine");
    await syncNow(db, "http://localhost:3001", "token-1");

    const [, , pushed] = (pushSync as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      { rows: { table: string }[] },
    ];
    const sessionIndex = pushed.rows.findIndex((r) => r.table === "workout_session");
    const setIndex = pushed.rows.findIndex((r) => r.table === "workout_set");
    expect(sessionIndex).toBeGreaterThanOrEqual(0);
    expect(sessionIndex).toBeLessThan(setIndex);

    expect(await getDirtySessions(db)).toEqual([]);
    expect(await getDirtySets(db)).toEqual([]);
    expect(await getActiveSession(db, "account-1")).toBeNull(); // the pulled "ended" change was applied
    expect((await listSetsForSession(db, session.id))[0].exerciseName).toBe("Bench Press"); // untouched
  });

  it("pushes a dirty body_metric row and applies a pulled one", async () => {
    const { pushSync, pullSync } = await import("./api");
    const metric: LocalBodyMetric = {
      id: "77777777-7777-7777-7777-777777777777",
      accountId: "account-1",
      metricType: "weight_kg",
      value: 72.5,
      photoRef: null,
      recordedAt: "2026-11-17T06:00:00.000Z",
      isDeleted: false,
      updatedAt: "2026-11-17T06:00:00.000Z",
    };
    (pushSync as ReturnType<typeof vi.fn>).mockResolvedValue({ applied: [metric.id], rejected: [] });
    (pullSync as ReturnType<typeof vi.fn>).mockResolvedValue({
      changes: [
        {
          table: "body_metric",
          op: "upsert",
          row: {
            id: "88888888-8888-8888-8888-888888888888",
            accountId: "account-1",
            isDeleted: false,
            updatedAt: "2026-11-17T07:00:00.000Z",
            metricType: "weight_kg",
            value: 73,
            recordedAt: "2026-11-17T07:00:00.000Z",
          },
        },
      ],
      nextSyncToken: "2026-11-17T07:00:00.000Z",
    });
    await insertBodyMetric(db, metric);

    const { syncNow } = await import("./sync-engine");
    await syncNow(db, "http://localhost:3001", "token-1");

    expect(pushSync).toHaveBeenCalledWith(
      "http://localhost:3001",
      "token-1",
      expect.objectContaining({
        rows: expect.arrayContaining([expect.objectContaining({ table: "body_metric", row: expect.objectContaining({ id: metric.id }) })]),
      }),
    );
    expect(await getDirtyBodyMetrics(db)).toEqual([]);
    expect((await getLatest(db, "account-1", "weight_kg"))?.value).toBe(73); // the pulled row was applied
  });

  it("pushes a dirty fasting_log row (endedAt omitted while active) and applies a pulled one", async () => {
    const { pushSync, pullSync } = await import("./api");
    const activeId = "99999999-0000-0000-0000-000000000001";
    (pushSync as ReturnType<typeof vi.fn>).mockResolvedValue({ applied: [activeId], rejected: [] });
    (pullSync as ReturnType<typeof vi.fn>).mockResolvedValue({
      changes: [
        {
          table: "fasting_log",
          op: "upsert",
          row: {
            id: "99999999-0000-0000-0000-000000000002",
            accountId: "account-1",
            isDeleted: false,
            updatedAt: "2026-11-22T12:00:00.000Z",
            startedAt: "2026-11-21T20:00:00.000Z",
            endedAt: "2026-11-22T12:00:00.000Z",
            targetMinutes: 960,
          },
        },
      ],
      nextSyncToken: "2026-11-22T12:00:00.000Z",
    });
    await startFast(db, {
      id: activeId,
      accountId: "account-1",
      startedAt: "2026-11-23T20:00:00.000Z",
      targetMinutes: 960,
      updatedAt: "2026-11-23T20:00:00.000Z",
    });

    const { syncNow } = await import("./sync-engine");
    await syncNow(db, "http://localhost:3001", "token-1");

    const pushed = (pushSync as ReturnType<typeof vi.fn>).mock.calls[0][2].rows.find(
      (r: { table: string }) => r.table === "fasting_log",
    );
    expect(pushed.row).toMatchObject({ id: activeId, targetMinutes: 960 });
    expect(pushed.row.endedAt).toBeUndefined();
    expect(await getDirtyFasting(db)).toEqual([]);
    expect((await listRecentFasts(db, "account-1")).map((r) => r.id)).toContain("99999999-0000-0000-0000-000000000002");
  });

  it("notifies sync-settled listeners even when the sync fails offline, and not after unsubscribing", async () => {
    const { pullSync } = await import("./api");
    (pullSync as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("Network request failed"));
    const { onSyncSettled, syncNow } = await import("./sync-engine");
    const listener = vi.fn();
    const unsubscribe = onSyncSettled(listener);

    await syncNow(db, "http://localhost:3001", "token-1");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await syncNow(db, "http://localhost:3001", "token-1");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("collapses overlapping calls into a single run", async () => {
    const { pushSync, pullSync } = await import("./api");
    (pullSync as ReturnType<typeof vi.fn>).mockResolvedValue({ changes: [], nextSyncToken: "t1" });

    const { syncNow } = await import("./sync-engine");
    const first = syncNow(db, "http://localhost:3001", "token-1");
    const second = syncNow(db, "http://localhost:3001", "token-1");
    await Promise.all([first, second]);

    expect(pushSync).not.toHaveBeenCalled(); // nothing dirty, but proves both calls shared one run
    expect(pullSync).toHaveBeenCalledTimes(1);
  });
});
