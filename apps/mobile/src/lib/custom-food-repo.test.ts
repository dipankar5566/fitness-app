import { beforeEach, describe, expect, it } from "vitest";
import {
  applyRemoteCustomFoods,
  applyRemoteIngredients,
  getDirtyCustomFoods,
  getDirtyIngredients,
  insertCustomFood,
  insertIngredient,
  listCustomFoods,
  listIngredients,
  markCustomFoodClean,
  markIngredientClean,
  softDeleteCustomFood,
  type LocalCustomFood,
  type LocalCustomFoodIngredient,
} from "./custom-food-repo";
import { createTestDb } from "./node-sqlite-test-db";
import type { SqlDb } from "./sql-db";

const CUSTOM_FOOD: LocalCustomFood = {
  id: "11111111-1111-1111-1111-111111111111",
  accountId: "account-1",
  name: "Overnight oats",
  isDeleted: false,
  updatedAt: "2026-11-16T12:00:00.000Z",
};

const INGREDIENT: LocalCustomFoodIngredient = {
  id: "22222222-2222-2222-2222-222222222222",
  accountId: "account-1",
  customFoodId: CUSTOM_FOOD.id,
  foodSource: "indb",
  foodRef: "L002",
  quantityG: 50,
  isDeleted: false,
  updatedAt: "2026-11-16T12:00:00.000Z",
};

describe("custom-food-repo", () => {
  let db: SqlDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("round-trips a custom food and its ingredients", async () => {
    await insertCustomFood(db, CUSTOM_FOOD);
    await insertIngredient(db, INGREDIENT);

    expect(await listCustomFoods(db, "account-1")).toEqual([CUSTOM_FOOD]);
    expect(await listIngredients(db, CUSTOM_FOOD.id)).toEqual([INGREDIENT]);
  });

  it("excludes custom foods for a different account", async () => {
    await insertCustomFood(db, CUSTOM_FOOD);
    await insertCustomFood(db, { ...CUSTOM_FOOD, id: "other", accountId: "account-2" });

    expect((await listCustomFoods(db, "account-1")).map((f) => f.id)).toEqual([CUSTOM_FOOD.id]);
  });

  it("a freshly-inserted custom food and ingredient are both dirty", async () => {
    await insertCustomFood(db, CUSTOM_FOOD);
    await insertIngredient(db, INGREDIENT);

    expect((await getDirtyCustomFoods(db)).map((f) => f.id)).toEqual([CUSTOM_FOOD.id]);
    expect((await getDirtyIngredients(db)).map((i) => i.id)).toEqual([INGREDIENT.id]);
  });

  it("markCustomFoodClean/markIngredientClean clear the dirty flag for the exact pushed version", async () => {
    await insertCustomFood(db, CUSTOM_FOOD);
    await insertIngredient(db, INGREDIENT);

    await markCustomFoodClean(db, CUSTOM_FOOD.id, CUSTOM_FOOD.updatedAt);
    await markIngredientClean(db, INGREDIENT.id, INGREDIENT.updatedAt);

    expect(await getDirtyCustomFoods(db)).toEqual([]);
    expect(await getDirtyIngredients(db)).toEqual([]);
  });

  it("softDeleteCustomFood soft-deletes the recipe and all of its ingredients together", async () => {
    await insertCustomFood(db, CUSTOM_FOOD);
    await insertIngredient(db, INGREDIENT);
    await markCustomFoodClean(db, CUSTOM_FOOD.id, CUSTOM_FOOD.updatedAt);
    await markIngredientClean(db, INGREDIENT.id, INGREDIENT.updatedAt);

    await softDeleteCustomFood(db, CUSTOM_FOOD.id, "2026-11-16T13:00:00.000Z");

    expect(await listCustomFoods(db, "account-1")).toEqual([]);
    expect(await listIngredients(db, CUSTOM_FOOD.id)).toEqual([]);
    const dirtyFoods = await getDirtyCustomFoods(db);
    const dirtyIngredients = await getDirtyIngredients(db);
    expect(dirtyFoods[0].isDeleted).toBe(true);
    expect(dirtyIngredients[0].isDeleted).toBe(true);
  });

  describe("applyRemote*", () => {
    it("inserts rows that don't exist locally yet, clean (not dirty)", async () => {
      await applyRemoteCustomFoods(db, [CUSTOM_FOOD]);
      await applyRemoteIngredients(db, [INGREDIENT]);

      expect(await listCustomFoods(db, "account-1")).toEqual([CUSTOM_FOOD]);
      expect(await getDirtyCustomFoods(db)).toEqual([]);
      expect(await getDirtyIngredients(db)).toEqual([]);
    });

    it("keeps a local pending edit that is newer than the incoming pull row", async () => {
      await insertCustomFood(db, CUSTOM_FOOD); // dirty, local edit not yet pushed
      await softDeleteCustomFood(db, CUSTOM_FOOD.id, "2026-11-16T15:00:00.000Z"); // newer local edit

      await applyRemoteCustomFoods(db, [{ ...CUSTOM_FOOD, updatedAt: "2026-11-16T12:30:00.000Z" }]);

      const dirty = await getDirtyCustomFoods(db);
      expect(dirty[0].isDeleted).toBe(true); // the local delete survived, not overwritten
    });

    it("overwrites a dirty local row when the incoming row is newer", async () => {
      await insertCustomFood(db, CUSTOM_FOOD);

      await applyRemoteCustomFoods(db, [{ ...CUSTOM_FOOD, name: "Renamed", updatedAt: "2026-11-16T16:00:00.000Z" }]);

      const [food] = await listCustomFoods(db, "account-1");
      expect(food.name).toBe("Renamed");
      expect(await getDirtyCustomFoods(db)).toEqual([]);
    });
  });
});
