import { activeFast } from "@fitness-app/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { applyRemote, end, getDirty, listRecent, markClean, softDelete, start } from "./fasting-repo";
import { createTestDb } from "./node-sqlite-test-db";
import type { SqlDb } from "./sql-db";

const ID_A = "11111111-1111-1111-1111-111111111111";
const ID_B = "22222222-2222-2222-2222-222222222222";
const STARTED = "2026-11-23T20:00:00.000Z";

describe("fasting-repo", () => {
  let db: SqlDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("start -> active fast; end -> no active fast, row stays dirty for sync", async () => {
    await start(db, { id: ID_A, accountId: "account-1", startedAt: STARTED, targetMinutes: 960, updatedAt: STARTED });
    expect(activeFast(await listRecent(db, "account-1"))?.id).toBe(ID_A);

    await end(db, ID_A, "2026-11-24T12:10:00.000Z");
    const rows = await listRecent(db, "account-1");
    expect(activeFast(rows)).toBeNull();
    expect(rows[0]).toMatchObject({ endedAt: "2026-11-24T12:10:00.000Z", updatedAt: "2026-11-24T12:10:00.000Z" });
    expect((await getDirty(db)).map((r) => r.id)).toEqual([ID_A]);
  });

  it("end never overwrites an already-ended fast", async () => {
    await start(db, { id: ID_A, accountId: "account-1", startedAt: STARTED, targetMinutes: 960, updatedAt: STARTED });
    await end(db, ID_A, "2026-11-24T12:10:00.000Z");
    await end(db, ID_A, "2026-11-24T15:00:00.000Z");
    expect((await listRecent(db, "account-1"))[0].endedAt).toBe("2026-11-24T12:10:00.000Z");
  });

  it("markClean only clears the version that was pushed", async () => {
    await start(db, { id: ID_A, accountId: "account-1", startedAt: STARTED, targetMinutes: 960, updatedAt: STARTED });
    await end(db, ID_A, "2026-11-24T12:10:00.000Z"); // edited after a push of the STARTED version began
    await markClean(db, ID_A, STARTED);
    expect(await getDirty(db)).toHaveLength(1);
    await markClean(db, ID_A, "2026-11-24T12:10:00.000Z");
    expect(await getDirty(db)).toHaveLength(0);
  });

  it("softDelete hides the fast from listRecent", async () => {
    await start(db, { id: ID_A, accountId: "account-1", startedAt: STARTED, targetMinutes: 960, updatedAt: STARTED });
    await softDelete(db, ID_A, "2026-11-23T20:05:00.000Z");
    expect(await listRecent(db, "account-1")).toEqual([]);
  });

  it("applyRemote inserts pulled rows clean, but never clobbers a newer dirty local edit", async () => {
    await start(db, { id: ID_A, accountId: "account-1", startedAt: STARTED, targetMinutes: 960, updatedAt: STARTED });
    await end(db, ID_A, "2026-11-24T12:10:00.000Z");

    await applyRemote(db, [
      { id: ID_A, accountId: "account-1", startedAt: STARTED, endedAt: null, targetMinutes: 960, isDeleted: false, updatedAt: STARTED },
      { id: ID_B, accountId: "account-1", startedAt: "2026-11-21T20:00:00.000Z", endedAt: "2026-11-22T12:00:00.000Z", targetMinutes: 960, isDeleted: false, updatedAt: "2026-11-22T12:00:00.000Z" },
    ]);

    const rows = await listRecent(db, "account-1");
    expect(rows.find((r) => r.id === ID_A)?.endedAt).toBe("2026-11-24T12:10:00.000Z");
    expect(rows.find((r) => r.id === ID_B)?.endedAt).toBe("2026-11-22T12:00:00.000Z");
    expect((await getDirty(db)).map((r) => r.id)).toEqual([ID_A]);
  });
});
