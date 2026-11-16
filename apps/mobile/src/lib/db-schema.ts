import type { SqlDb } from "./sql-db.js";

const SCHEMA_VERSION = 2;

/**
 * Local SQLite mirror for offline sync (ARCHITECTURE.md section 3). `food_log` mirrors app.food_log
 * plus a local-only macro snapshot (so Home can total kcal without the server) and `is_dirty` (the
 * outbox flag - rows with is_dirty=1 haven't been pushed yet, or were edited after a push started).
 * `food_cache` lets LogFoodScreen/FoodSearchScreen work offline for recently-seen foods. `kv` holds
 * the sync token and a cached profile snapshot for the offline-cold-start case. `custom_food`/
 * `custom_food_ingredient` mirror their app.* counterparts the same way as food_log, for offline
 * recipe building/logging.
 *
 * Deliberately has no expo-sqlite import, unlike db.ts, so tests can run this against a `node:sqlite`
 * -backed SqlDb without trying to load the native module outside React Native.
 */
export async function migrate(db: SqlDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS food_log (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        food_source TEXT NOT NULL,
        food_ref TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        logged_at TEXT NOT NULL,
        source TEXT NOT NULL,
        is_estimate INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        kcal REAL,
        protein_g REAL,
        fat_g REAL,
        carb_g REAL,
        is_dirty INTEGER NOT NULL DEFAULT 1
      )
    `);
    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS food_log_account_day_idx ON food_log (account_id, logged_at)",
    );
    await db.execAsync(
      "CREATE TABLE IF NOT EXISTS food_cache (code TEXT PRIMARY KEY, json TEXT NOT NULL, last_used_at TEXT NOT NULL)",
    );
    await db.execAsync("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  }

  if (currentVersion < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS custom_food (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        is_dirty INTEGER NOT NULL DEFAULT 1
      )
    `);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS custom_food_ingredient (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        custom_food_id TEXT NOT NULL,
        food_source TEXT NOT NULL,
        food_ref TEXT NOT NULL,
        quantity_g REAL NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        is_dirty INTEGER NOT NULL DEFAULT 1
      )
    `);
    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS custom_food_ingredient_parent_idx ON custom_food_ingredient (custom_food_id)",
    );
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
