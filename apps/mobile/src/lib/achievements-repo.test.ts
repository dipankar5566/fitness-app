import { beforeEach, describe, expect, it } from "vitest";
import { getNewlyUnlocked, loadAchievements, markBadgesSeen } from "./achievements-repo";
import { end as endFast, start as startFast } from "./fasting-repo";
import { insert as insertFoodLog, type LocalFoodLogRow } from "./food-log-repo";
import { createTestDb } from "./node-sqlite-test-db";
import type { SqlDb } from "./sql-db";
import { insert as insertWater } from "./water-repo";
import { insertSession, insertSet } from "./workout-repo";

const ACCOUNT = "account-1";

function food(id: string, loggedAt: string): LocalFoodLogRow {
  return {
    id,
    accountId: ACCOUNT,
    foodSource: "indb",
    foodRef: "L002",
    quantity: 100,
    unit: "g",
    mealType: "lunch",
    loggedAt,
    source: "manual",
    isEstimate: false,
    isDeleted: false,
    updatedAt: loggedAt,
    macros: null,
    foodName: null,
  };
}

async function session(db: SqlDb, id: string, startedAt: string, weightKg: number) {
  await insertSession(db, { id, accountId: ACCOUNT, programDayId: null, startedAt, endedAt: null, isDeleted: false, updatedAt: startedAt });
  await insertSet(db, {
    id: `${id}-set`,
    accountId: ACCOUNT,
    sessionId: id,
    exerciseId: "bench",
    exerciseName: "Bench press",
    setNo: 1,
    reps: 5,
    weightKg,
    rpe: null,
    isWarmup: false,
    isDeleted: false,
    updatedAt: startedAt,
  });
}

describe("achievements-repo", () => {
  let db: SqlDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("derives badges from local food logs, workouts, water and fasts", async () => {
    for (let day = 17; day <= 19; day++) {
      await insertFoodLog(db, food(`food-${day}`, `2026-11-${day}T12:00:00.000Z`));
    }
    await session(db, "s1", "2026-11-17T18:00:00.000Z", 60);
    await session(db, "s2", "2026-11-19T18:00:00.000Z", 62.5); // beats s1 -> one PR
    for (let glass = 0; glass < 12; glass++) {
      await insertWater(db, {
        id: `w-${glass}`,
        accountId: ACCOUNT,
        amountMl: 250,
        recordedAt: `2026-11-18T${String(8 + glass).padStart(2, "0")}:00:00.000Z`,
        isDeleted: false,
        updatedAt: "2026-11-18T08:00:00.000Z",
      });
    }
    await startFast(db, { id: "f1", accountId: ACCOUNT, startedAt: "2026-11-17T20:00:00.000Z", targetMinutes: 960, updatedAt: "2026-11-17T20:00:00.000Z" });
    await endFast(db, "f1", "2026-11-18T12:30:00.000Z");

    const summary = await loadAchievements(db, ACCOUNT);
    const unlocked = summary.badges.filter((b) => b.unlocked).map((b) => b.id);

    expect(unlocked).toEqual(expect.arrayContaining(["streak_3", "workout_1", "pr_1", "fast_1"]));
    expect(summary.badges.find((b) => b.id === "water_7")?.progress).toBe(1); // 3000 ml >= default goal on one day
    expect(summary.points).toBeGreaterThan(0);
  });

  it("reports a newly unlocked badge once, then not again after it's marked seen", async () => {
    await session(db, "s1", "2026-11-17T18:00:00.000Z", 60);

    const summary = await loadAchievements(db, ACCOUNT);
    const fresh = await getNewlyUnlocked(db, summary);
    expect(fresh.map((b) => b.id)).toEqual(["workout_1"]);

    await markBadgesSeen(db, fresh.map((b) => b.id));
    expect(await getNewlyUnlocked(db, summary)).toEqual([]);
  });
});
