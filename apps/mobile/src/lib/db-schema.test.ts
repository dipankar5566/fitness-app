import { describe, expect, it } from "vitest";
import { migrate } from "./db-schema";
import { createTestDb, createUnmigratedTestDb } from "./node-sqlite-test-db";
import type { SqlDb } from "./sql-db";

async function hasFoodNameColumn(db: SqlDb): Promise<boolean> {
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(food_log)");
  return columns.some((column) => column.name === "food_name");
}

describe("migrate", () => {
  it("brings a brand-new database to the current schema, including food_log.food_name", async () => {
    const db = await createTestDb();
    expect(await hasFoodNameColumn(db)).toBe(true);
  });

  it("is a no-op the second time it's called on an already-current database", async () => {
    const db = await createTestDb();
    await expect(migrate(db)).resolves.toBeUndefined();
    expect(await hasFoodNameColumn(db)).toBe(true);
  });

  it("heals a database stuck at user_version=5 with food_name missing (observed on a real device: an app teardown mid-migration let the version bump commit without the ALTER surviving)", async () => {
    const db = createUnmigratedTestDb();
    // Hand-build the "stuck" state directly, bypassing migrate() entirely: every table up to v4,
    // but food_log without food_name, and user_version already claiming v5.
    await db.execAsync(`
      CREATE TABLE food_log (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, food_source TEXT NOT NULL, food_ref TEXT NOT NULL,
        quantity REAL NOT NULL, unit TEXT NOT NULL, meal_type TEXT NOT NULL, logged_at TEXT NOT NULL,
        source TEXT NOT NULL, is_estimate INTEGER NOT NULL DEFAULT 0, is_deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL, kcal REAL, protein_g REAL, fat_g REAL, carb_g REAL, is_dirty INTEGER NOT NULL DEFAULT 1
      )
    `);
    await db.execAsync("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    await db.runAsync("INSERT INTO kv (key, value) VALUES ('sync_token', 'some-old-token')");
    await db.execAsync("PRAGMA user_version = 5");
    expect(await hasFoodNameColumn(db)).toBe(false); // sanity check on the state we just built

    await migrate(db);

    expect(await hasFoodNameColumn(db)).toBe(true);
    // The healing path also clears the sync token, the same way the normal v4->v5 path does, so
    // pre-existing rows get their name backfilled on the next pull.
    expect(await db.getFirstAsync("SELECT value FROM kv WHERE key = 'sync_token'")).toBeNull();
  });

  it("does not touch food_log again if it's already healthy at user_version=5", async () => {
    const db = await createTestDb(); // already fully migrated, food_name present
    await db.runAsync(
      "INSERT INTO kv (key, value) VALUES ('sync_token', 'keep-me') ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [],
    );

    await migrate(db);

    // The healing check must not fire (and clear the token) when the column is already there.
    expect(await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = 'sync_token'")).toEqual({
      value: "keep-me",
    });
  });
});
