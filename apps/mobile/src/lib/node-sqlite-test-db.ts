import { createRequire } from "node:module";
import { migrate } from "./db-schema";
import type { SqlDb } from "./sql-db";

// Vite/Vitest's module resolver doesn't recognize the newer `node:sqlite` builtin as external and
// tries to bundle it, which fails - createRequire bypasses Vite's resolution and uses Node's own.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/**
 * Test-only SqlDb backed by node:sqlite (Node 24, already the CI runtime - no new dependency).
 * expo-sqlite can't load under Vitest's node environment, so repo/engine tests run real SQL against
 * this instead of mocking the database away.
 */
export async function createTestDb(): Promise<SqlDb> {
  const raw = new DatabaseSync(":memory:");

  const db: SqlDb = {
    execAsync: (sql) => {
      raw.exec(sql);
      return Promise.resolve();
    },
    runAsync: (sql, params = []) => {
      const info = raw.prepare(sql).run(...(params as never[]));
      return Promise.resolve({ changes: Number(info.changes), lastInsertRowId: Number(info.lastInsertRowid) });
    },
    getAllAsync: (sql, params = []) => Promise.resolve(raw.prepare(sql).all(...(params as never[])) as never[]),
    getFirstAsync: (sql, params = []) => {
      const row = raw.prepare(sql).get(...(params as never[]));
      return Promise.resolve((row ?? null) as never);
    },
    withTransactionAsync: async (fn) => {
      raw.exec("BEGIN");
      try {
        await fn();
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };

  await migrate(db);
  return db;
}
