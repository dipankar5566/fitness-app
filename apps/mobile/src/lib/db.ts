import { openDatabaseAsync, type SQLiteBindParams, type SQLiteDatabase } from "expo-sqlite";
import { migrate } from "./db-schema.js";
import type { SqlDb } from "./sql-db.js";

const DATABASE_NAME = "fitness.db";

let dbPromise: Promise<SqlDb> | null = null;

/** Adapts expo-sqlite's variadic-params overloads to the plain `(sql, params?)` shape SqlDb expects. */
function toSqlDb(db: SQLiteDatabase): SqlDb {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params) =>
      params ? db.runAsync(sql, params as SQLiteBindParams) : db.runAsync(sql),
    getAllAsync: (sql, params) =>
      params ? db.getAllAsync(sql, params as SQLiteBindParams) : db.getAllAsync(sql),
    getFirstAsync: (sql, params) =>
      params ? db.getFirstAsync(sql, params as SQLiteBindParams) : db.getFirstAsync(sql),
    withTransactionAsync: (fn) => db.withTransactionAsync(fn),
  };
}

export function getDatabase(): Promise<SqlDb> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      const sqlDb = toSqlDb(db);
      await migrate(sqlDb);
      return sqlDb;
    });
  }
  return dbPromise;
}
