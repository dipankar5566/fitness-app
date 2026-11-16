/**
 * The slice of expo-sqlite's `SQLiteDatabase` that migration/repository code needs. Writing against
 * this interface instead of the concrete expo-sqlite type lets tests back it with `node:sqlite`
 * (synchronous, Promise-wrapped) so real SQL runs under Vitest's node environment, where the native
 * expo-sqlite module can't load.
 */
export interface SqlDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}
