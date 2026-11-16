import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { ProgramService } from "./program.service.js";

describe("ProgramService", () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let service: ProgramService;

  beforeEach(async () => {
    db = { query: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [ProgramService, { provide: DatabaseService, useValue: db }],
    }).compile();
    service = moduleRef.get(ProgramService);
  });

  it("returns an empty array without querying days/exercises when there are no programs", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.listBuiltIn();

    expect(result).toEqual([]);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("nests days and exercises under their program, in position/day_index order", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: "program-1", name: "Push / Pull / Legs", description: "3-day split" }],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: "day-1", program_id: "program-1", day_index: 0, name: "Push" },
          { id: "day-2", program_id: "program-1", day_index: 1, name: "Pull" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            program_day_id: "day-1",
            exercise_id: "Barbell_Bench_Press_-_Medium_Grip",
            exercise_name: "Barbell Bench Press - Medium Grip",
            position: 0,
            target_sets: 4,
            target_reps: "6-10",
          },
          {
            program_day_id: "day-2",
            exercise_id: "Bent_Over_Barbell_Row",
            exercise_name: "Bent Over Barbell Row",
            position: 0,
            target_sets: 4,
            target_reps: "6-10",
          },
        ],
      });

    const result = await service.listBuiltIn();

    expect(result).toEqual([
      {
        id: "program-1",
        name: "Push / Pull / Legs",
        description: "3-day split",
        days: [
          {
            id: "day-1",
            dayIndex: 0,
            name: "Push",
            exercises: [
              {
                exerciseId: "Barbell_Bench_Press_-_Medium_Grip",
                exerciseName: "Barbell Bench Press - Medium Grip",
                position: 0,
                targetSets: 4,
                targetReps: "6-10",
              },
            ],
          },
          {
            id: "day-2",
            dayIndex: 1,
            name: "Pull",
            exercises: [
              {
                exerciseId: "Bent_Over_Barbell_Row",
                exerciseName: "Bent Over Barbell Row",
                position: 0,
                targetSets: 4,
                targetReps: "6-10",
              },
            ],
          },
        ],
      },
    ]);
  });

  it("gives a day with no program_exercise rows an empty exercises array", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: "program-1", name: "Empty", description: null }] })
      .mockResolvedValueOnce({ rows: [{ id: "day-1", program_id: "program-1", day_index: 0, name: "Day 1" }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.listBuiltIn();

    expect(result[0].days[0].exercises).toEqual([]);
  });
});
