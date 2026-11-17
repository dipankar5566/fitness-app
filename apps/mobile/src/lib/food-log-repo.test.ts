import { beforeEach, describe, expect, it } from "vitest";
import {
  applyRemote,
  getDirty,
  insert,
  listByLocalDay,
  listLoggedLocalDays,
  markClean,
  softDelete,
  type LocalFoodLogRow,
} from "./food-log-repo";
import { createTestDb } from "./node-sqlite-test-db";
import type { SqlDb } from "./sql-db";

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

describe("food-log-repo", () => {
  let db: SqlDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("round-trips a row through insert and listByLocalDay, including the macro snapshot", async () => {
    await insert(db, ROW);

    const [entry] = await listByLocalDay(db, "account-1", "2026-11-14");

    expect(entry).toEqual(ROW);
  });

  it("excludes rows for a different account or a different day", async () => {
    await insert(db, ROW);
    await insert(db, { ...ROW, id: "other-account", accountId: "account-2" });
    await insert(db, { ...ROW, id: "other-day", loggedAt: "2026-11-15T12:00:00.000Z" });

    const entries = await listByLocalDay(db, "account-1", "2026-11-14");

    expect(entries.map((e) => e.id)).toEqual([ROW.id]);
  });

  it("a freshly-inserted row is dirty (queued for the next push)", async () => {
    await insert(db, ROW);

    const dirty = await getDirty(db);

    expect(dirty.map((row) => row.id)).toEqual([ROW.id]);
  });

  it("markClean clears the dirty flag only for the exact pushed version", async () => {
    await insert(db, ROW);

    await markClean(db, ROW.id, ROW.updatedAt);

    expect(await getDirty(db)).toEqual([]);
  });

  it("markClean no-ops if the row was edited again after the push started (stays dirty)", async () => {
    await insert(db, ROW);
    await softDelete(db, ROW.id, "2026-11-14T13:00:00.000Z"); // edits updated_at forward, re-dirties

    await markClean(db, ROW.id, ROW.updatedAt); // the stale (pre-edit) updatedAt from the in-flight push

    const dirty = await getDirty(db);
    expect(dirty).toHaveLength(1);
    expect(dirty[0].updatedAt).toBe("2026-11-14T13:00:00.000Z");
  });

  it("softDelete marks the row deleted and dirty, and excludes it from listByLocalDay", async () => {
    await insert(db, ROW);
    await markClean(db, ROW.id, ROW.updatedAt);

    await softDelete(db, ROW.id, "2026-11-14T13:00:00.000Z");

    expect(await listByLocalDay(db, "account-1", "2026-11-14")).toEqual([]);
    expect((await getDirty(db))[0].isDeleted).toBe(true);
  });

  describe("listLoggedLocalDays", () => {
    it("returns each distinct logged day, excluding deleted entries and other accounts", async () => {
      await insert(db, ROW); // account-1, 2026-11-14
      await insert(db, { ...ROW, id: "same-day-2", loggedAt: "2026-11-14T18:00:00.000Z" }); // same day again
      await insert(db, { ...ROW, id: "other-day", loggedAt: "2026-11-15T08:00:00.000Z" });
      await insert(db, { ...ROW, id: "deleted-day", loggedAt: "2026-11-10T08:00:00.000Z", isDeleted: true });
      await insert(db, { ...ROW, id: "other-account", accountId: "account-2", loggedAt: "2026-11-16T08:00:00.000Z" });

      const days = await listLoggedLocalDays(db, "account-1", "2026-01-01");

      expect(new Set(days)).toEqual(new Set(["2026-11-14", "2026-11-15"]));
    });

    it("excludes days before sinceDate", async () => {
      await insert(db, ROW); // 2026-11-14
      await insert(db, { ...ROW, id: "too-old", loggedAt: "2025-01-01T08:00:00.000Z" });

      const days = await listLoggedLocalDays(db, "account-1", "2026-01-01");

      expect(days).toEqual(["2026-11-14"]);
    });
  });

  describe("applyRemote", () => {
    it("inserts a row that doesn't exist locally yet, clean (not dirty)", async () => {
      await applyRemote(db, [ROW]);

      expect(await listByLocalDay(db, "account-1", "2026-11-14")).toEqual([ROW]);
      expect(await getDirty(db)).toEqual([]);
    });

    it("overwrites a local row that isn't dirty", async () => {
      await applyRemote(db, [ROW]);

      const updated = { ...ROW, quantity: 200, updatedAt: "2026-11-14T14:00:00.000Z" };
      await applyRemote(db, [updated]);

      const [entry] = await listByLocalDay(db, "account-1", "2026-11-14");
      expect(entry.quantity).toBe(200);
    });

    it("keeps a local pending edit that is newer than the incoming pull row", async () => {
      await insert(db, ROW); // dirty, local edit not yet pushed
      await softDelete(db, ROW.id, "2026-11-14T15:00:00.000Z"); // a newer local edit

      // An older server row for the same id (e.g. from a pull that started before the edit).
      await applyRemote(db, [{ ...ROW, updatedAt: "2026-11-14T12:30:00.000Z" }]);

      const dirty = await getDirty(db);
      expect(dirty[0].isDeleted).toBe(true); // the local delete survived, not overwritten
    });

    it("overwrites a dirty local row when the incoming row is newer (server caught up)", async () => {
      await insert(db, ROW); // dirty

      await applyRemote(db, [{ ...ROW, quantity: 999, updatedAt: "2026-11-14T16:00:00.000Z" }]);

      const [entry] = await listByLocalDay(db, "account-1", "2026-11-14");
      expect(entry.quantity).toBe(999);
      expect(await getDirty(db)).toEqual([]); // applyRemote always writes is_dirty = 0
    });

    it("backfills food_name onto a pre-existing row that was logged before the column existed", async () => {
      // Simulates a row from before this fix: inserted with no food_name, server catches up on
      // the next pull with the real resolved name.
      await insert(db, { ...ROW, foodName: null });

      await applyRemote(db, [{ ...ROW, updatedAt: "2026-11-14T16:00:00.000Z", foodName: "Idli" }]);

      const [entry] = await listByLocalDay(db, "account-1", "2026-11-14");
      expect(entry.foodName).toBe("Idli");
    });

    it("keeps the existing local name instead of nulling it out when the incoming row has none", async () => {
      await applyRemote(db, [ROW]); // ROW.foodName = "Idli", clean

      await applyRemote(db, [{ ...ROW, quantity: 999, updatedAt: "2026-11-14T16:00:00.000Z", foodName: null }]);

      const [entry] = await listByLocalDay(db, "account-1", "2026-11-14");
      expect(entry.quantity).toBe(999);
      expect(entry.foodName).toBe("Idli"); // not wiped by the null incoming name
    });
  });
});
