import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

interface ExerciseRow {
  id: string;
  name: string;
  muscles: { primary: string[]; secondary: string[] } | null;
  equipment: string | null;
  instructions: string[] | null;
  image_urls: string[] | null;
}

export interface ExerciseSummary {
  id: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string | null;
  instructions: string[];
  imageUrls: string[];
}

export interface ExerciseFilter {
  muscle?: string;
  equipment?: string;
}

@Injectable()
export class ExerciseService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Built-in exercise library (free-exercise-db import, db/import-exercises.ts) filtered by muscle
   * (checked against both primary and secondary) and/or equipment - PRD section 5.4. Excludes
   * is_custom rows: no custom-exercise creation flow exists yet, and those rows will need
   * account-id scoping once one does - not something to half-implement ahead of that feature.
   */
  async list(filter: ExerciseFilter): Promise<ExerciseSummary[]> {
    const conditions = ["NOT is_custom"];
    const params: unknown[] = [];
    if (filter.muscle) {
      params.push(filter.muscle);
      conditions.push(
        `(muscles->'primary' @> to_jsonb($${params.length}::text) OR muscles->'secondary' @> to_jsonb($${params.length}::text))`,
      );
    }
    if (filter.equipment) {
      params.push(filter.equipment);
      conditions.push(`equipment = $${params.length}`);
    }

    const result = await this.db.query<ExerciseRow>(
      `SELECT id, name, muscles, equipment, instructions, image_urls
       FROM app.exercise
       WHERE ${conditions.join(" AND ")}
       ORDER BY name`,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      primaryMuscles: row.muscles?.primary ?? [],
      secondaryMuscles: row.muscles?.secondary ?? [],
      equipment: row.equipment,
      instructions: row.instructions ?? [],
      imageUrls: row.image_urls ?? [],
    }));
  }
}
