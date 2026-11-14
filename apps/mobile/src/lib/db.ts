import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

const DATABASE_NAME = "fitness.db";

let dbPromise: Promise<SQLiteDatabase> | null = null;

/**
 * Local SQLite mirror for offline sync (ARCHITECTURE.md section 3). Empty for M1 - M2 adds the
 * syncable tables (food_log, workout_session, ...) and the actual sync protocol.
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}
