import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { FoodService } from "../food/food.service.js";
import { SyncService } from "./sync.service.js";

const validUpsertRow = {
  id: "11111111-1111-1111-1111-111111111111",
  accountId: "22222222-2222-2222-2222-222222222222", // must be ignored - account comes from the JWT, not the row
  isDeleted: false,
  updatedAt: "2026-11-14T12:00:00.000Z",
  foodSource: "indb",
  foodRef: "L002",
  quantity: 150,
  unit: "g",
  mealType: "lunch",
  loggedAt: "2026-11-14T12:00:00.000Z",
  source: "manual",
  isEstimate: false,
};

describe("SyncService", () => {
  let client: { query: ReturnType<typeof vi.fn> };
  let db: { query: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
  let food: { getNutrientSummaries: ReturnType<typeof vi.fn> };
  let service: SyncService;

  beforeEach(async () => {
    client = { query: vi.fn() };
    db = {
      query: vi.fn(),
      transaction: vi.fn(async (fn: (c: typeof client) => Promise<unknown>) => fn(client)),
    };
    food = { getNutrientSummaries: vi.fn().mockResolvedValue(new Map()) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: DatabaseService, useValue: db },
        { provide: FoodService, useValue: food },
      ],
    }).compile();
    service = moduleRef.get(SyncService);
  });

  describe("push", () => {
    it("takes account_id from the JWT argument, not the pushed row", async () => {
      client.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.push("account-1", {
        syncToken: null,
        rows: [{ table: "food_log", op: "upsert", row: validUpsertRow }],
      });

      expect(result).toEqual({ applied: [validUpsertRow.id], rejected: [] });
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO app.food_log"),
        expect.arrayContaining(["account-1"]),
      );
    });

    it("rejects as stale when the server already has an equal-or-newer version owned by the same account", async () => {
      client.query
        .mockResolvedValueOnce({ rowCount: 0 }) // the upsert's WHERE guard didn't match
        .mockResolvedValueOnce({ rows: [{ account_id: "account-1" }] }); // conflictReason lookup

      const result = await service.push("account-1", {
        syncToken: null,
        rows: [{ table: "food_log", op: "upsert", row: validUpsertRow }],
      });

      expect(result).toEqual({ applied: [], rejected: [{ id: validUpsertRow.id, reason: "stale" }] });
    });

    it("rejects as not_owner when the row id belongs to a different account", async () => {
      client.query
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ account_id: "someone-else" }] });

      const result = await service.push("account-1", {
        syncToken: null,
        rows: [{ table: "food_log", op: "upsert", row: validUpsertRow }],
      });

      expect(result).toEqual({ applied: [], rejected: [{ id: validUpsertRow.id, reason: "not_owner" }] });
    });

    it("applies a delete op as a soft delete", async () => {
      client.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.push("account-1", {
        syncToken: null,
        rows: [
          {
            table: "food_log",
            op: "delete",
            row: { id: validUpsertRow.id, updatedAt: validUpsertRow.updatedAt },
          },
        ],
      });

      expect(result).toEqual({ applied: [validUpsertRow.id], rejected: [] });
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining("is_deleted = true"), expect.any(Array));
    });

    it("rejects a malformed row as invalid without failing the rest of the batch", async () => {
      client.query.mockResolvedValueOnce({ rowCount: 1 }); // the second, valid row

      const result = await service.push("account-1", {
        syncToken: null,
        rows: [
          { table: "food_log", op: "upsert", row: { id: "bad-row" } }, // missing required fields
          { table: "food_log", op: "upsert", row: validUpsertRow },
        ],
      });

      expect(result).toEqual({
        applied: [validUpsertRow.id],
        rejected: [{ id: "bad-row", reason: "invalid" }],
      });
    });
  });

  describe("pull", () => {
    it("advances the sync token to the last row's server_updated_at and applies the overlap window", async () => {
      const serverUpdatedAt = new Date("2026-11-15T00:00:00.000Z");
      db.query.mockResolvedValue({
        rows: [
          {
            id: validUpsertRow.id,
            account_id: "account-1",
            food_source: "indb",
            food_ref: "L002",
            quantity: "150",
            unit: "g",
            meal_type: "lunch",
            logged_at: new Date("2026-11-14T12:00:00.000Z"),
            source: "manual",
            is_estimate: false,
            is_deleted: false,
            updated_at: new Date("2026-11-14T12:00:00.000Z"),
            server_updated_at: serverUpdatedAt,
          },
        ],
      });

      const since = "2026-11-14T23:59:00.000Z";
      const result = await service.pull("account-1", since);

      expect(result.nextSyncToken).toBe(serverUpdatedAt.toISOString());
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toMatchObject({ table: "food_log", op: "upsert" });

      const [, params] = db.query.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBe("account-1");
      expect(params[1]).toBe(new Date(new Date(since).getTime() - 5000).toISOString());
    });

    it("returns the previous token unchanged when there are no changes", async () => {
      db.query.mockResolvedValue({ rows: [] });
      const since = "2026-11-14T23:59:00.000Z";

      const result = await service.pull("account-1", since);

      expect(result).toEqual({ changes: [], nextSyncToken: since });
    });
  });
});
