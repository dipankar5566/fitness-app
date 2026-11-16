import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { ExerciseService } from "./exercise.service.js";

describe("ExerciseService", () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let service: ExerciseService;

  beforeEach(async () => {
    db = { query: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [ExerciseService, { provide: DatabaseService, useValue: db }],
    }).compile();
    service = moduleRef.get(ExerciseService);
  });

  it("maps rows into the camelCase summary shape, defaulting null jsonb columns", async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: "Bench_Press",
          name: "Bench Press",
          muscles: { primary: ["chest"], secondary: ["triceps"] },
          equipment: "barbell",
          instructions: ["Lie on the bench.", "Press the bar up."],
          image_urls: ["https://cdn.jsdelivr.net/gh/x/0.jpg"],
        },
        {
          id: "Custom_Thing",
          name: "No muscles yet",
          muscles: null,
          equipment: null,
          instructions: null,
          image_urls: null,
        },
      ],
    });

    const result = await service.list({});

    expect(result).toEqual([
      {
        id: "Bench_Press",
        name: "Bench Press",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["triceps"],
        equipment: "barbell",
        instructions: ["Lie on the bench.", "Press the bar up."],
        imageUrls: ["https://cdn.jsdelivr.net/gh/x/0.jpg"],
      },
      {
        id: "Custom_Thing",
        name: "No muscles yet",
        primaryMuscles: [],
        secondaryMuscles: [],
        equipment: null,
        instructions: [],
        imageUrls: [],
      },
    ]);
  });

  it("always excludes custom exercises, with no other filter", async () => {
    db.query.mockResolvedValue({ rows: [] });

    await service.list({});

    expect(db.query).toHaveBeenCalledWith(
      "SELECT id, name, muscles, equipment, instructions, image_urls\n       FROM app.exercise\n       WHERE NOT is_custom\n       ORDER BY name",
      [],
    );
  });

  it("adds a muscle condition checked against both primary and secondary", async () => {
    db.query.mockResolvedValue({ rows: [] });

    await service.list({ muscle: "chest" });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("muscles->'primary' @> to_jsonb($1::text)");
    expect(sql).toContain("muscles->'secondary' @> to_jsonb($1::text)");
    expect(params).toEqual(["chest"]);
  });

  it("adds an equipment condition", async () => {
    db.query.mockResolvedValue({ rows: [] });

    await service.list({ equipment: "barbell" });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("equipment = $1");
    expect(params).toEqual(["barbell"]);
  });

  it("combines muscle and equipment filters with their own positional params", async () => {
    db.query.mockResolvedValue({ rows: [] });

    await service.list({ muscle: "chest", equipment: "barbell" });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("muscles->'primary' @> to_jsonb($1::text)");
    expect(sql).toContain("equipment = $2");
    expect(params).toEqual(["chest", "barbell"]);
  });
});
