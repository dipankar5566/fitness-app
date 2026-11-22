import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./node-sqlite-test-db";
import type { SqlDb } from "./sql-db";
import {
  applyRemote,
  getDirty,
  insert,
  markClean,
  softDeleteLatestBetween,
  totalMlBetween,
  type LocalWaterLog,
} from "./water-repo";

const DAY_START = "2026-11-23T00:00:00.000Z";
const DAY_END = "2026-11-24T00:00:00.000Z";

function glass(id: string, amountMl: number, recordedAt: string): LocalWaterLog {
  return { id, accountId: "account-1", amountMl, recordedAt, isDeleted: false, updatedAt: recordedAt };
}

describe("water-repo", () => {
  let db: SqlDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("sums the day's glasses, ignoring other days and soft-deletes", async () => {
    await insert(db, glass("11111111-1111-1111-1111-111111111111", 250, "2026-11-23T08:00:00.000Z"));
    await insert(db, glass("22222222-2222-2222-2222-222222222222", 250, "2026-11-23T12:00:00.000Z"));
    await insert(db, glass("33333333-3333-3333-3333-333333333333", 500, "2026-11-22T20:00:00.000Z")); // prior day

    expect(await totalMlBetween(db, "account-1", DAY_START, DAY_END)).toBe(500);
  });

  it("softDeleteLatestBetween removes the most recent glass and lowers the total", async () => {
    await insert(db, glass("11111111-1111-1111-1111-111111111111", 250, "2026-11-23T08:00:00.000Z"));
    await insert(db, glass("22222222-2222-2222-2222-222222222222", 250, "2026-11-23T12:00:00.000Z"));

    const removed = await softDeleteLatestBetween(db, "account-1", DAY_START, DAY_END, "2026-11-23T13:00:00.000Z");

    expect(removed).toBe(true);
    expect(await totalMlBetween(db, "account-1", DAY_START, DAY_END)).toBe(250);
  });

  it("softDeleteLatestBetween returns false when there's nothing to remove", async () => {
    expect(await softDeleteLatestBetween(db, "account-1", DAY_START, DAY_END, "2026-11-23T13:00:00.000Z")).toBe(false);
  });

  it("marks inserts and deletes dirty, and markClean clears the flag", async () => {
    const row = glass("11111111-1111-1111-1111-111111111111", 250, "2026-11-23T08:00:00.000Z");
    await insert(db, row);

    expect((await getDirty(db)).map((r) => r.id)).toEqual([row.id]);

    await markClean(db, row.id, row.updatedAt);
    expect(await getDirty(db)).toEqual([]);
  });

  it("applyRemote upserts a clean row and does not clobber a dirtier local edit", async () => {
    // A remote row for an id we've never seen: inserts clean.
    await applyRemote(db, [glass("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", 300, "2026-11-23T09:00:00.000Z")]);
    expect(await getDirty(db)).toEqual([]);
    expect(await totalMlBetween(db, "account-1", DAY_START, DAY_END)).toBe(300);

    // A local dirty edit with a newer updatedAt must survive an older remote version.
    const local = glass("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", 500, "2026-11-23T10:00:00.000Z");
    await insert(db, { ...local, updatedAt: "2026-11-23T10:00:00.000Z" });
    await applyRemote(db, [{ ...local, amountMl: 100, updatedAt: "2026-11-23T09:00:00.000Z" }]);

    expect(await totalMlBetween(db, "account-1", DAY_START, DAY_END)).toBe(800); // 300 + local 500 kept
  });
});
