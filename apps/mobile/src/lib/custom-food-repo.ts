import type { SqlDb } from "./sql-db";

export interface LocalCustomFood {
  id: string;
  accountId: string;
  name: string;
  isDeleted: boolean;
  updatedAt: string;
}

export interface LocalCustomFoodIngredient {
  id: string;
  accountId: string;
  customFoodId: string;
  foodSource: string;
  foodRef: string;
  quantityG: number;
  isDeleted: boolean;
  updatedAt: string;
}

interface CustomFoodSqlRow {
  id: string;
  account_id: string;
  name: string;
  is_deleted: number;
  updated_at: string;
}

interface CustomFoodIngredientSqlRow {
  id: string;
  account_id: string;
  custom_food_id: string;
  food_source: string;
  food_ref: string;
  quantity_g: number;
  is_deleted: number;
  updated_at: string;
}

function fromCustomFoodRow(row: CustomFoodSqlRow): LocalCustomFood {
  return { id: row.id, accountId: row.account_id, name: row.name, isDeleted: row.is_deleted === 1, updatedAt: row.updated_at };
}

function fromIngredientRow(row: CustomFoodIngredientSqlRow): LocalCustomFoodIngredient {
  return {
    id: row.id,
    accountId: row.account_id,
    customFoodId: row.custom_food_id,
    foodSource: row.food_source,
    foodRef: row.food_ref,
    quantityG: row.quantity_g,
    isDeleted: row.is_deleted === 1,
    updatedAt: row.updated_at,
  };
}

// --- custom_food ---

export async function insertCustomFood(db: SqlDb, row: LocalCustomFood): Promise<void> {
  await db.runAsync(
    "INSERT INTO custom_food (id, account_id, name, is_deleted, updated_at, is_dirty) VALUES (?, ?, ?, ?, ?, 1)",
    [row.id, row.accountId, row.name, row.isDeleted ? 1 : 0, row.updatedAt],
  );
}

export async function listCustomFoods(db: SqlDb, accountId: string): Promise<LocalCustomFood[]> {
  const rows = await db.getAllAsync<CustomFoodSqlRow>(
    "SELECT * FROM custom_food WHERE account_id = ? AND is_deleted = 0 ORDER BY name",
    [accountId],
  );
  return rows.map(fromCustomFoodRow);
}

/** Soft-deletes the recipe and all of its local ingredient rows together, so the whole recipe's
 * deletion syncs as one unit instead of orphaning ingredient rows. */
export async function softDeleteCustomFood(db: SqlDb, id: string, updatedAt: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE custom_food SET is_deleted = 1, updated_at = ?, is_dirty = 1 WHERE id = ?", [
      updatedAt,
      id,
    ]);
    await db.runAsync(
      "UPDATE custom_food_ingredient SET is_deleted = 1, updated_at = ?, is_dirty = 1 WHERE custom_food_id = ?",
      [updatedAt, id],
    );
  });
}

export async function getDirtyCustomFoods(db: SqlDb): Promise<LocalCustomFood[]> {
  const rows = await db.getAllAsync<CustomFoodSqlRow>("SELECT * FROM custom_food WHERE is_dirty = 1");
  return rows.map(fromCustomFoodRow);
}

export async function markCustomFoodClean(db: SqlDb, id: string, pushedUpdatedAt: string): Promise<void> {
  await db.runAsync("UPDATE custom_food SET is_dirty = 0 WHERE id = ? AND updated_at = ?", [id, pushedUpdatedAt]);
}

export async function applyRemoteCustomFoods(db: SqlDb, rows: LocalCustomFood[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await db.getFirstAsync<{ updated_at: string; is_dirty: number }>(
        "SELECT updated_at, is_dirty FROM custom_food WHERE id = ?",
        [row.id],
      );
      if (local && local.is_dirty === 1 && local.updated_at >= row.updatedAt) {
        continue;
      }
      await db.runAsync(
        `INSERT INTO custom_food (id, account_id, name, is_deleted, updated_at, is_dirty) VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT (id) DO UPDATE SET
           account_id = excluded.account_id, name = excluded.name, is_deleted = excluded.is_deleted,
           updated_at = excluded.updated_at, is_dirty = 0`,
        [row.id, row.accountId, row.name, row.isDeleted ? 1 : 0, row.updatedAt],
      );
    }
  });
}

// --- custom_food_ingredient ---

export async function insertIngredient(db: SqlDb, row: LocalCustomFoodIngredient): Promise<void> {
  await db.runAsync(
    `INSERT INTO custom_food_ingredient
       (id, account_id, custom_food_id, food_source, food_ref, quantity_g, is_deleted, updated_at, is_dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [row.id, row.accountId, row.customFoodId, row.foodSource, row.foodRef, row.quantityG, row.isDeleted ? 1 : 0, row.updatedAt],
  );
}

export async function listIngredients(db: SqlDb, customFoodId: string): Promise<LocalCustomFoodIngredient[]> {
  const rows = await db.getAllAsync<CustomFoodIngredientSqlRow>(
    "SELECT * FROM custom_food_ingredient WHERE custom_food_id = ? AND is_deleted = 0",
    [customFoodId],
  );
  return rows.map(fromIngredientRow);
}

export async function getDirtyIngredients(db: SqlDb): Promise<LocalCustomFoodIngredient[]> {
  const rows = await db.getAllAsync<CustomFoodIngredientSqlRow>(
    "SELECT * FROM custom_food_ingredient WHERE is_dirty = 1",
  );
  return rows.map(fromIngredientRow);
}

export async function markIngredientClean(db: SqlDb, id: string, pushedUpdatedAt: string): Promise<void> {
  await db.runAsync("UPDATE custom_food_ingredient SET is_dirty = 0 WHERE id = ? AND updated_at = ?", [
    id,
    pushedUpdatedAt,
  ]);
}

export async function applyRemoteIngredients(db: SqlDb, rows: LocalCustomFoodIngredient[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await db.getFirstAsync<{ updated_at: string; is_dirty: number }>(
        "SELECT updated_at, is_dirty FROM custom_food_ingredient WHERE id = ?",
        [row.id],
      );
      if (local && local.is_dirty === 1 && local.updated_at >= row.updatedAt) {
        continue;
      }
      await db.runAsync(
        `INSERT INTO custom_food_ingredient
           (id, account_id, custom_food_id, food_source, food_ref, quantity_g, is_deleted, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT (id) DO UPDATE SET
           account_id = excluded.account_id, custom_food_id = excluded.custom_food_id,
           food_source = excluded.food_source, food_ref = excluded.food_ref, quantity_g = excluded.quantity_g,
           is_deleted = excluded.is_deleted, updated_at = excluded.updated_at, is_dirty = 0`,
        [
          row.id, row.accountId, row.customFoodId, row.foodSource, row.foodRef, row.quantityG,
          row.isDeleted ? 1 : 0, row.updatedAt,
        ],
      );
    }
  });
}
