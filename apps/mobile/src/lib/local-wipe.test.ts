import { describe, expect, it } from "vitest";
import { setKv } from "./kv-store";
import { wipeAccountData } from "./local-wipe";
import { createTestDb } from "./node-sqlite-test-db";

describe("wipeAccountData", () => {
  it("clears every account-scoped table and kv key, but keeps theme/reminder preferences", async () => {
    const db = await createTestDb();

    await db.runAsync(
      "INSERT INTO food_log (id, account_id, food_source, food_ref, quantity, unit, meal_type, logged_at, source, is_estimate, is_deleted, updated_at, is_dirty) VALUES ('f1','acc-1','indb','code1',1,'piece','breakfast','2026-01-01T00:00:00Z','manual',0,0,'2026-01-01T00:00:00Z',0)",
    );
    await db.runAsync("INSERT INTO food_cache (code, json, last_used_at) VALUES ('code1', '{}', '2026-01-01T00:00:00Z')");
    await db.runAsync(
      "INSERT INTO water_log (id, account_id, amount_ml, recorded_at, is_deleted, updated_at, is_dirty) VALUES ('w1','acc-1',250,'2026-01-01T00:00:00Z',0,'2026-01-01T00:00:00Z',0)",
    );

    await setKv(db, "theme_preference", "dark");
    await setKv(db, "reminder_settings", "[]");
    await setKv(db, "cached_profile", "{\"sex\":\"male\"}");
    await setKv(db, "sync_token", "abc123");

    await wipeAccountData(db);

    expect(await db.getAllAsync("SELECT * FROM food_log")).toEqual([]);
    expect(await db.getAllAsync("SELECT * FROM food_cache")).toEqual([]);
    expect(await db.getAllAsync("SELECT * FROM water_log")).toEqual([]);

    const remainingKeys = (await db.getAllAsync<{ key: string }>("SELECT key FROM kv")).map((r) => r.key);
    expect(remainingKeys.sort()).toEqual(["reminder_settings", "theme_preference"]);
  });

  it("is safe to call on a freshly migrated, empty database", async () => {
    const db = await createTestDb();
    await expect(wipeAccountData(db)).resolves.toBeUndefined();
  });
});
