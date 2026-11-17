import type { SqlDb } from "./sql-db";

const SCHEMA_VERSION = 5;

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
 * `food_log.food_name` is a local-only display snapshot too (same idea as `workout_set.
 * exercise_name`) - filled at log time and backfilled on pull, since the synced row itself has no
 * such column (the server always re-resolves the name from food_source/food_ref).
 *
 * Deliberately has no expo-sqlite import, unlike db.ts, so tests can run this against a `node:sqlite`
 * -backed SqlDb without trying to load the native module outside React Native.
 */
export async function migrate(db: SqlDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const currentVersion = row?.user_version ?? 0;

  // Self-healing guard, independent of the version counter below - observed in practice on a
  // real device: an app/process teardown mid-migration (e.g. during a dev Fast Refresh cycle)
  // can let the version-bump statement commit while an earlier ALTER in the same migrate() call
  // doesn't survive, leaving user_version claiming v5 is applied while food_name is still
  // missing. Checked unconditionally on every call - PRAGMA table_info is cheap - so a device
  // already stuck in that state gets healed instead of permanently skipping the ALTER (the
  // normal forward-migration path below handles a device that hasn't reached v5 at all yet).
  if (currentVersion >= 5) {
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(food_log)");
    if (!columns.some((column) => column.name === "food_name")) {
      await db.execAsync("ALTER TABLE food_log ADD COLUMN food_name TEXT");
      await db.execAsync("DELETE FROM kv WHERE key = 'sync_token'");
    }
  }

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

  if (currentVersion < 5) {
    // food_name is a local-only display snapshot (like workout_set.exercise_name) - the synced
    // row has no such column, the server resolves it fresh from food_source/food_ref every time.
    await db.execAsync("ALTER TABLE food_log ADD COLUMN food_name TEXT");
    // Every food_log row that already existed on this device was written before this column
    // existed, so it's NULL - clearing the sync token forces one full re-pull, and
    // applyRemote's COALESCE backfills food_name onto those rows without disturbing anything else.
    await db.execAsync("DELETE FROM kv WHERE key = 'sync_token'");
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
