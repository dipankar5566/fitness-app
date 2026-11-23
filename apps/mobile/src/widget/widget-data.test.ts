import { beforeEach, describe, expect, it } from "vitest";
import { insert as insertFoodLog } from "../lib/food-log-repo";
import { CACHED_GOAL_KEY, setKv } from "../lib/kv-store";
import { createTestDb } from "../lib/node-sqlite-test-db";
import type { SqlDb } from "../lib/sql-db";
import { insert as insertWater } from "../lib/water-repo";
import { loadWidgetSnapshot } from "./widget-data";

const NOW = new Date("2026-11-23T15:00:00.000Z");

describe("loadWidgetSnapshot", () => {
  let db: SqlDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("shows no target before onboarding, but still counts water", async () => {
    await insertWater(db, {
      id: "w1",
      accountId: "a",
      amountMl: 250,
      recordedAt: "2026-11-23T09:00:00.000Z",
      isDeleted: false,
      updatedAt: "2026-11-23T09:00:00.000Z",
    });

    const snapshot = await loadWidgetSnapshot(db, "a", NOW);

    expect(snapshot).toMatchObject({ targetKcal: null, kcalLeft: null, waterMl: 250 });
    expect(snapshot.waterGoalMl).toBeGreaterThan(0);
  });

  it("kcal left falls as today's food is logged, and ignores other days", async () => {
    await setKv(db, CACHED_GOAL_KEY, JSON.stringify({ target_kcal: "2200" }));
    const base = {
      accountId: "a",
      foodSource: "indb",
      foodRef: "X",
      quantity: 100,
      unit: "g",
      mealType: "lunch",
      source: "manual",
      isEstimate: false,
      isDeleted: false,
      foodName: null,
    };
    const empty = await loadWidgetSnapshot(db, "a", NOW);
    await insertFoodLog(db, {
      ...base,
      id: "f1",
      loggedAt: "2026-11-23T12:00:00.000Z",
      updatedAt: "2026-11-23T12:00:00.000Z",
      macros: { kcal: 500, proteinG: 20, fatG: 10, carbG: 70 },
    });
    await insertFoodLog(db, {
      ...base,
      id: "f2",
      loggedAt: "2026-11-22T12:00:00.000Z",
      updatedAt: "2026-11-22T12:00:00.000Z",
      macros: { kcal: 900, proteinG: 20, fatG: 10, carbG: 70 },
    });

    const after = await loadWidgetSnapshot(db, "a", NOW);

    expect(empty.kcalLeft).toBe(2200);
    expect(after.eatenKcal).toBe(500);
    expect(after.kcalLeft).toBe(1700);
  });
});
