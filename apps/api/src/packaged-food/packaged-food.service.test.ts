import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { PackagedFoodService } from "./packaged-food.service.js";

describe("PackagedFoodService", () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let service: PackagedFoodService;

  beforeEach(async () => {
    db = { query: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [PackagedFoodService, { provide: DatabaseService, useValue: db }],
    }).compile();
    service = moduleRef.get(PackagedFoodService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("lookupByBarcode", () => {
    it("returns the cached row without calling Open Food Facts when one already exists", async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: "pf-1",
            barcode: "8901234567890",
            name: "Maggi Noodles",
            brand: "Nestle",
            nutrients: { energy_kcal: 400, protein_g: 10, fat_g: 15, carb_g: 55, fibre_g: 2 },
          },
        ],
      });
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await service.lookupByBarcode("8901234567890");

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: "pf-1",
        barcode: "8901234567890",
        name: "Maggi Noodles",
        brand: "Nestle",
        nutrientsPer100g: { energy_kcal: 400, protein_g: 10, fat_g: 15, carb_g: 55, fibre_g: 2 },
      });
    });

    it("on a cache miss, maps Open Food Facts nutrients and upserts a new row", async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // cache lookup miss
        .mockResolvedValueOnce({
          rows: [
            {
              id: "pf-2",
              barcode: "8901234500000",
              name: "Lay's Classic",
              brand: "PepsiCo",
              nutrients: { energy_kcal: 536, protein_g: 6.3, fat_g: 34, carb_g: 53, fibre_g: null },
            },
          ],
        });
      const fetchMock = vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: 1,
            product: {
              product_name: "Lay's Classic",
              brands: "PepsiCo",
              nutriments: {
                "energy-kcal_100g": 536,
                proteins_100g: 6.3,
                fat_100g: 34,
                carbohydrates_100g: 53,
              },
            },
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await service.lookupByBarcode("8901234500000");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toContain("8901234500000");
      expect((init.headers as Record<string, string>)["User-Agent"]).toBeTruthy();

      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO app.packaged_food"),
        expect.arrayContaining([
          "8901234500000",
          "Lay's Classic",
          "PepsiCo",
          JSON.stringify({ energy_kcal: 536, protein_g: 6.3, fat_g: 34, carb_g: 53, fibre_g: null }),
        ]),
      );
      expect(result).toEqual({
        id: "pf-2",
        barcode: "8901234500000",
        name: "Lay's Classic",
        brand: "PepsiCo",
        nutrientsPer100g: { energy_kcal: 536, protein_g: 6.3, fat_g: 34, carb_g: 53, fibre_g: null },
      });
    });

    it("returns null when Open Food Facts has no product for this barcode, without writing anything", async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ status: 0 }), { status: 200 })),
      );

      const result = await service.lookupByBarcode("0000000000000");

      expect(result).toBeNull();
      expect(db.query).toHaveBeenCalledTimes(1); // only the cache-miss lookup, no insert
    });

    it("throws when Open Food Facts itself returns a non-2xx response", async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("", { status: 500 })),
      );

      await expect(service.lookupByBarcode("1111111111111")).rejects.toThrow(/status 500/);
    });
  });

  describe("getNutrientSummaries", () => {
    it("returns an empty map without querying for an empty id list", async () => {
      const result = await service.getNutrientSummaries([]);

      expect(result.size).toBe(0);
      expect(db.query).not.toHaveBeenCalled();
    });

    it("maps rows keyed by id into the camelCase macro shape, including confidence", async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: "pf-1",
            nutrients: { energy_kcal: 400, protein_g: 10, fat_g: 15, carb_g: 55, fibre_g: 2 },
            confidence: "unverified",
          },
        ],
      });

      const result = await service.getNutrientSummaries(["pf-1"]);

      expect(result.get("pf-1")).toEqual({
        kcal: 400,
        proteinG: 10,
        fatG: 15,
        carbG: 55,
        confidence: "unverified",
      });
    });

    it("defaults confidence to 'unverified' when a row is somehow missing the column", async () => {
      db.query.mockResolvedValue({
        rows: [{ id: "pf-1", nutrients: { energy_kcal: 400, protein_g: 10, fat_g: 15, carb_g: 55, fibre_g: 2 } }],
      });

      const result = await service.getNutrientSummaries(["pf-1"]);

      expect(result.get("pf-1")?.confidence).toBe("unverified");
    });
  });
});
