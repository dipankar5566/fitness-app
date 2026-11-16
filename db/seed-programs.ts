/**
 * Seeds the 4 built-in programs (PRD §5.4) into app.program/app.program_day/app.program_exercise -
 * account_id NULL marks them built-in (vs. a future user-created program). Every exercise_id below
 * was looked up against the real imported app.exercise data (db/import-exercises.ts) via psql, not
 * guessed, since exercise_id has a hard FK to app.exercise(id).
 *
 * Re-runnable: every row's id is a deterministic hash of a readable slug (programs/days/exercises
 * have no natural external key the way exercises do), so re-running always UPSERTs the same rows
 * instead of duplicating them.
 *
 * Usage: DATABASE_URL=postgresql://user:pass@host:port/db pnpm seed:programs
 */
import { createHash } from "node:crypto";
import { Client } from "pg";

function stableId(slug: string): string {
  const hex = createHash("sha1").update(slug).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

interface ProgramExerciseSeed {
  exerciseId: string;
  targetSets: number;
  targetReps: string;
}

interface ProgramDaySeed {
  name: string;
  exercises: ProgramExerciseSeed[];
}

interface ProgramSeed {
  slug: string;
  name: string;
  description: string;
  days: ProgramDaySeed[];
}

const PROGRAMS: ProgramSeed[] = [
  {
    slug: "ppl",
    name: "Push / Pull / Legs",
    description: "Classic 3-day barbell split: push (chest/shoulders/triceps), pull (back/biceps), legs.",
    days: [
      {
        name: "Push",
        exercises: [
          { exerciseId: "Barbell_Bench_Press_-_Medium_Grip", targetSets: 4, targetReps: "6-10" },
          { exerciseId: "Barbell_Shoulder_Press", targetSets: 3, targetReps: "8-12" },
          { exerciseId: "Incline_Barbell_Triceps_Extension", targetSets: 3, targetReps: "10-15" },
        ],
      },
      {
        name: "Pull",
        exercises: [
          { exerciseId: "Barbell_Deadlift", targetSets: 3, targetReps: "5-8" },
          { exerciseId: "Bent_Over_Barbell_Row", targetSets: 4, targetReps: "6-10" },
          { exerciseId: "Pullups", targetSets: 3, targetReps: "6-12" },
          { exerciseId: "Barbell_Curl", targetSets: 3, targetReps: "10-15" },
        ],
      },
      {
        name: "Legs",
        exercises: [
          { exerciseId: "Barbell_Squat", targetSets: 4, targetReps: "6-10" },
          { exerciseId: "Leg_Press", targetSets: 3, targetReps: "10-15" },
          { exerciseId: "Barbell_Lunge", targetSets: 3, targetReps: "8-12" },
          { exerciseId: "Standing_Barbell_Calf_Raise", targetSets: 3, targetReps: "12-20" },
        ],
      },
    ],
  },
  {
    slug: "upper-lower",
    name: "Upper / Lower",
    description: "2-day split alternating upper and lower body - fits well at 4 training days/week.",
    days: [
      {
        name: "Upper",
        exercises: [
          { exerciseId: "Barbell_Bench_Press_-_Medium_Grip", targetSets: 4, targetReps: "6-10" },
          { exerciseId: "Bent_Over_Barbell_Row", targetSets: 4, targetReps: "6-10" },
          { exerciseId: "Barbell_Shoulder_Press", targetSets: 3, targetReps: "8-12" },
          { exerciseId: "Barbell_Curl", targetSets: 3, targetReps: "10-15" },
        ],
      },
      {
        name: "Lower",
        exercises: [
          { exerciseId: "Barbell_Squat", targetSets: 4, targetReps: "6-10" },
          { exerciseId: "Barbell_Deadlift", targetSets: 3, targetReps: "5-8" },
          { exerciseId: "Barbell_Lunge", targetSets: 3, targetReps: "8-12" },
          { exerciseId: "Standing_Barbell_Calf_Raise", targetSets: 3, targetReps: "12-20" },
        ],
      },
    ],
  },
  {
    slug: "full-body-beginner",
    name: "Full Body (Beginner)",
    description: "2 alternating full-body days (A/B) built around the big barbell lifts - a classic beginner strength template.",
    days: [
      {
        name: "Full Body A",
        exercises: [
          { exerciseId: "Barbell_Squat", targetSets: 3, targetReps: "5" },
          { exerciseId: "Barbell_Bench_Press_-_Medium_Grip", targetSets: 3, targetReps: "5" },
          { exerciseId: "Bent_Over_Barbell_Row", targetSets: 3, targetReps: "5" },
        ],
      },
      {
        name: "Full Body B",
        exercises: [
          { exerciseId: "Barbell_Squat", targetSets: 3, targetReps: "5" },
          { exerciseId: "Barbell_Shoulder_Press", targetSets: 3, targetReps: "5" },
          { exerciseId: "Barbell_Deadlift", targetSets: 1, targetReps: "5" },
        ],
      },
    ],
  },
  {
    slug: "home-no-equipment",
    name: "Home (No Equipment)",
    description: "2 alternating bodyweight-only full-body days - no gym or equipment needed.",
    days: [
      {
        name: "Home A",
        exercises: [
          { exerciseId: "Bodyweight_Squat", targetSets: 3, targetReps: "12-20" },
          { exerciseId: "Push-Up_Wide", targetSets: 3, targetReps: "8-15" },
          { exerciseId: "Single_Leg_Glute_Bridge", targetSets: 3, targetReps: "10-15" },
          { exerciseId: "Plank", targetSets: 3, targetReps: "30-60s" },
        ],
      },
      {
        name: "Home B",
        exercises: [
          { exerciseId: "Freehand_Jump_Squat", targetSets: 3, targetReps: "10-15" },
          { exerciseId: "Pullups", targetSets: 3, targetReps: "AMRAP" },
          { exerciseId: "Crunches", targetSets: 3, targetReps: "15-25" },
          { exerciseId: "Superman", targetSets: 3, targetReps: "12-15" },
        ],
      },
    ],
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const program of PROGRAMS) {
      const programId = stableId(`program:${program.slug}`);
      await client.query(
        `INSERT INTO app.program (id, account_id, name, description) VALUES ($1, NULL, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
        [programId, program.name, program.description],
      );

      for (let dayIndex = 0; dayIndex < program.days.length; dayIndex++) {
        const day = program.days[dayIndex];
        const dayId = stableId(`program_day:${program.slug}:${dayIndex}`);
        await client.query(
          `INSERT INTO app.program_day (id, program_id, day_index, name) VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             program_id = EXCLUDED.program_id, day_index = EXCLUDED.day_index, name = EXCLUDED.name`,
          [dayId, programId, dayIndex, day.name],
        );

        for (let position = 0; position < day.exercises.length; position++) {
          const exercise = day.exercises[position];
          const programExerciseId = stableId(`program_exercise:${program.slug}:${dayIndex}:${position}`);
          await client.query(
            `INSERT INTO app.program_exercise (id, program_day_id, exercise_id, position, target_sets, target_reps)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               program_day_id = EXCLUDED.program_day_id, exercise_id = EXCLUDED.exercise_id,
               position = EXCLUDED.position, target_sets = EXCLUDED.target_sets, target_reps = EXCLUDED.target_reps`,
            [programExerciseId, dayId, exercise.exerciseId, position, exercise.targetSets, exercise.targetReps],
          );
        }
      }
    }

    console.log(`seeded ${PROGRAMS.length} built-in programs.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
