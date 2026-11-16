import type { FoodDetail } from "./api";
import type { SqlDb } from "./sql-db";

/** Caches a food detail lookup so LogFoodScreen/FoodSearchScreen can work offline for recently-seen foods. */
export async function cacheFood(db: SqlDb, detail: FoodDetail): Promise<void> {
  await db.runAsync(
    `INSERT INTO food_cache (code, json, last_used_at) VALUES (?, ?, ?)
     ON CONFLICT (code) DO UPDATE SET json = excluded.json, last_used_at = excluded.last_used_at`,
    [detail.code, JSON.stringify(detail), new Date().toISOString()],
  );
}

export async function getCachedFood(db: SqlDb, code: string): Promise<FoodDetail | null> {
  const row = await db.getFirstAsync<{ json: string }>("SELECT json FROM food_cache WHERE code = ?", [code]);
  return row ? (JSON.parse(row.json) as FoodDetail) : null;
}

export async function listRecentFoods(db: SqlDb, limit = 20): Promise<FoodDetail[]> {
  const rows = await db.getAllAsync<{ json: string }>(
    "SELECT json FROM food_cache ORDER BY last_used_at DESC LIMIT ?",
    [limit],
  );
  return rows.map((row) => JSON.parse(row.json) as FoodDetail);
}
