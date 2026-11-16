import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDirtyCustomFoods, insertCustomFood, listCustomFoods, type LocalCustomFood } from "./custom-food-repo";
import { getDirty, insert, listByLocalDay, type LocalFoodLogRow } from "./food-log-repo";
import { getKv } from "./kv-store";
import { createTestDb } from "./node-sqlite-test-db";
import type { SqlDb } from "./sql-db";

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
    expect(entries.some((e) => e.foodRef === "L003")).toBe(true); // the pulled row was applied
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
