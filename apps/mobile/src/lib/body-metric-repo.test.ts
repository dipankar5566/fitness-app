import { beforeEach, describe, expect, it } from "vitest";
import {
  applyRemote,
  getDirty,
  getLatest,
  insert,
  markClean,
  type LocalBodyMetric,
} from "./body-metric-repo";
import { createTestDb } from "./node-sqlite-test-db";
import type { SqlDb } from "./sql-db";

const ROW: LocalBodyMetric = {
  id: "11111111-1111-1111-1111-111111111111",
  accountId: "account-1",
  metricType: "weight_kg",
  value: 72.5,
  photoRef: null,
  recordedAt: "2026-11-14T06:00:00.000Z",
  isDeleted: false,
  updatedAt: "2026-11-14T06:00:00.000Z",
};

describe("body-metric-repo", () => {
  let db: SqlDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("round-trips a row through insert and getLatest", async () => {
    await insert(db, ROW);

    expect(await getLatest(db, "account-1", "weight_kg")).toEqual(ROW);
  });

  it("getLatest returns the most recently recorded row of that type", async () => {
    await insert(db, ROW);
    await insert(db, { ...ROW, id: "22222222-2222-2222-2222-222222222222", value: 73, recordedAt: "2026-11-15T06:00:00.000Z" });

    const latest = await getLatest(db, "account-1", "weight_kg");

    expect(latest?.value).toBe(73);
  });

  it("getLatest ignores a different account or metric type", async () => {
    await insert(db, ROW);
    await insert(db, { ...ROW, id: "other-account", accountId: "account-2" });
    await insert(db, { ...ROW, id: "other-type", metricType: "waist_cm" });

    expect(await getLatest(db, "account-1", "weight_kg")).toEqual(ROW);
  });

  it("a freshly-inserted row is dirty (queued for the next push)", async () => {
    await insert(db, ROW);

    expect((await getDirty(db)).map((r) => r.id)).toEqual([ROW.id]);
  });

  it("insert is idempotent for the same id (Health Connect re-import doesn't duplicate or throw)", async () => {
    await insert(db, ROW);
    await insert(db, { ...ROW, value: 999 }); // same id, re-imported - must be a no-op, not an error

    const latest = await getLatest(db, "account-1", "weight_kg");
    expect(latest?.value).toBe(72.5); // original value kept, not overwritten
  });

  it("markClean clears the dirty flag only for the exact pushed version", async () => {
    await insert(db, ROW);

    await markClean(db, ROW.id, ROW.updatedAt);

    expect(await getDirty(db)).toEqual([]);
  });

  describe("applyRemote", () => {
    it("inserts a row that doesn't exist locally yet, clean (not dirty)", async () => {
      await applyRemote(db, [ROW]);

      expect(await getLatest(db, "account-1", "weight_kg")).toEqual(ROW);
      expect(await getDirty(db)).toEqual([]);
    });

    it("overwrites a local row that isn't dirty", async () => {
      await applyRemote(db, [ROW]);

      const updated = { ...ROW, value: 70, updatedAt: "2026-11-14T07:00:00.000Z" };
      await applyRemote(db, [updated]);

      expect((await getLatest(db, "account-1", "weight_kg"))?.value).toBe(70);
    });

    it("keeps a local pending edit (e.g. a soft delete) newer than the incoming pull row", async () => {
      await insert(db, ROW); // dirty, local, not yet pushed
      await db.runAsync("UPDATE body_metric SET is_deleted = 1, updated_at = ?, is_dirty = 1 WHERE id = ?", [
        "2026-11-14T08:00:00.000Z",
        ROW.id,
      ]);

      // An older server row for the same id (e.g. from a pull that started before the edit).
      await applyRemote(db, [{ ...ROW, updatedAt: "2026-11-14T06:30:00.000Z" }]);

      const dirty = await getDirty(db);
      expect(dirty[0].isDeleted).toBe(true); // the local delete survived, not overwritten
    });
  });
});
