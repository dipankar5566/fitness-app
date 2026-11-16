import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

interface ProgramRow {
  id: string;
  name: string;
  description: string | null;
}

interface ProgramDayRow {
  id: string;
  program_id: string;
  day_index: number;
  name: string;
}

interface ProgramExerciseRow {
  program_day_id: string;
  exercise_id: string;
  exercise_name: string;
  position: number;
  target_sets: number;
  target_reps: string | null;
}

export interface ProgramExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  position: number;
  targetSets: number;
  targetReps: string | null;
}

export interface ProgramDaySummary {
  id: string;
  dayIndex: number;
  name: string;
  exercises: ProgramExerciseSummary[];
}

export interface ProgramSummary {
  id: string;
  name: string;
  description: string | null;
  days: ProgramDaySummary[];
}

@Injectable()
export class ProgramService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Built-in programs (account_id IS NULL - no user-created programs exist yet) with their days
   * and exercises nested, joined against app.exercise for display names - PRD section 5.4. Three
   * queries total (programs, then their days, then those days' exercises), not one per program/day.
   */
  async listBuiltIn(): Promise<ProgramSummary[]> {
    const programs = await this.db.query<ProgramRow>(
      "SELECT id, name, description FROM app.program WHERE account_id IS NULL ORDER BY name",
    );
    if (programs.rows.length === 0) {
      return [];
    }

    const programIds = programs.rows.map((row) => row.id);
    const days = await this.db.query<ProgramDayRow>(
      "SELECT id, program_id, day_index, name FROM app.program_day WHERE program_id = ANY($1) ORDER BY day_index",
      [programIds],
    );

    const dayIds = days.rows.map((row) => row.id);
    const exercises =
      dayIds.length === 0
        ? { rows: [] as ProgramExerciseRow[] }
        : await this.db.query<ProgramExerciseRow>(
            `SELECT pe.program_day_id, pe.exercise_id, e.name AS exercise_name, pe.position, pe.target_sets, pe.target_reps
             FROM app.program_exercise pe JOIN app.exercise e ON e.id = pe.exercise_id
             WHERE pe.program_day_id = ANY($1) ORDER BY pe.position`,
            [dayIds],
          );

    const exercisesByDayId = new Map<string, ProgramExerciseSummary[]>();
    for (const row of exercises.rows) {
      const list = exercisesByDayId.get(row.program_day_id) ?? [];
      list.push({
        exerciseId: row.exercise_id,
        exerciseName: row.exercise_name,
        position: row.position,
        targetSets: row.target_sets,
        targetReps: row.target_reps,
      });
      exercisesByDayId.set(row.program_day_id, list);
    }

    const daysByProgramId = new Map<string, ProgramDaySummary[]>();
    for (const row of days.rows) {
      const list = daysByProgramId.get(row.program_id) ?? [];
      list.push({
        id: row.id,
        dayIndex: row.day_index,
        name: row.name,
        exercises: exercisesByDayId.get(row.id) ?? [],
      });
      daysByProgramId.set(row.program_id, list);
    }

    return programs.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      days: daysByProgramId.get(row.id) ?? [],
    }));
  }
}
