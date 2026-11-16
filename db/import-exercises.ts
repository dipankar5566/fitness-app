/**
 * One-off, re-runnable import of free-exercise-db (Unlicense/public domain, PRD section 5.4/8) into
 * app.exercise. Pinned to a specific commit so the dataset can't change under us on a re-run; bump
 * COMMIT_SHA deliberately (e.g. to pick up new exercises) rather than tracking a branch.
 *
 * Image hosting: exercises.json only has images as repo-relative paths ("3_4_Sit-Up/0.jpg"). Rather
 * than standing up our own image storage/CDN before a hosting decision exists (ARCHITECTURE.md,
 * decision due end of M3), we point image_urls at jsdelivr's GitHub CDN (cdn.jsdelivr.net/gh/...),
 * which - unlike raw.githubusercontent.com - is explicitly meant for hotlinking repo content and
 * sets real cache headers. Revisit if/when exercise images need to move behind our own infra.
 *
 * Usage: DATABASE_URL=postgresql://user:pass@host:port/db pnpm import:exercises
 */
import { Client } from "pg";

const REPO = "yuhonas/free-exercise-db";
const COMMIT_SHA = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
const DATA_URL = `https://raw.githubusercontent.com/${REPO}/${COMMIT_SHA}/dist/exercises.json`;
const IMAGE_BASE = `https://cdn.jsdelivr.net/gh/${REPO}@${COMMIT_SHA}/exercises`;

interface FreeExerciseDbRow {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

async function fetchExercises(): Promise<FreeExerciseDbRow[]> {
  const res = await fetch(DATA_URL);
  if (!res.ok) {
    throw new Error(`failed to fetch ${DATA_URL}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as FreeExerciseDbRow[];
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const exercises = await fetchExercises();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    let imported = 0;
    for (const exercise of exercises) {
      const muscles = { primary: exercise.primaryMuscles, secondary: exercise.secondaryMuscles };
      const imageUrls = exercise.images.map((path) => `${IMAGE_BASE}/${path}`);

      await client.query(
        `INSERT INTO app.exercise (id, name, muscles, equipment, instructions, image_urls, is_custom)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, muscles = EXCLUDED.muscles, equipment = EXCLUDED.equipment,
           instructions = EXCLUDED.instructions, image_urls = EXCLUDED.image_urls`,
        [
          exercise.id,
          exercise.name,
          JSON.stringify(muscles),
          exercise.equipment,
          JSON.stringify(exercise.instructions),
          JSON.stringify(imageUrls),
        ],
      );
      imported += 1;
    }

    console.log(`imported ${imported} exercises from ${REPO}@${COMMIT_SHA.slice(0, 7)}.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
