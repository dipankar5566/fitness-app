import type { SqlDb } from "./sql-db";

const SCHEMA_VERSION = 4;

/**
 * Local SQLite mirror for offline sync (ARCHITECTURE.md section 3). `food_log` mirrors app.food_log
 * plus a local-only macro snapshot (so Home can total kcal without the server) and `is_dirty` (the
 * outbox flag - rows with is_dirty=1 haven't been pushed yet, or were edited after a push started).
 * `food_cache` lets LogFoodScreen/FoodSearchScreen work offline for recently-seen foods. `kv` holds
 * the sync token and a cached profile snapshot for the offline-cold-start case. `custom_food`/
 * `custom_food_ingredient` mirror their app.* counterparts the same way as food_log, for offline
 * recipe building/logging. `workout_session`/`workout_set` mirror app.workout_session/
 * app.workout_set the same way, for offline workout logging; `workout_set.exercise_name` is a
 * local-only display snapshot (like food_log's macro columns) - the synced row has no such column.
 * `body_metric` mirrors app.body_metric the same way again, for offline-capable Health Connect
 * weight imports (and any future manual measurement entry) - see lib/health-connect.ts.
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

  if (currentVersion < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS workout_session (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        program_day_id TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        is_dirty INTEGER NOT NULL DEFAULT 1
      )
    `);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS workout_set (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        exercise_name TEXT,
        set_no INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        weight_kg REAL NOT NULL DEFAULT 0,
        rpe REAL,
        is_warmup INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        is_dirty INTEGER NOT NULL DEFAULT 1
      )
    `);
    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS workout_set_session_idx ON workout_set (session_id)",
    );
  }

  if (currentVersion < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS body_metric (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        value REAL,
        photo_ref TEXT,
        recorded_at TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        is_dirty INTEGER NOT NULL DEFAULT 1
      )
    `);
    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS body_metric_account_type_idx ON body_metric (account_id, metric_type, recorded_at)",
    );
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
