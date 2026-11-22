/**
 * Re-runnable loader for app.food_alias (0006_food_alias.sql) from the reviewed CSV
 * db/data/food-alias.csv. These regional/Hinglish aliases are OUR OWN work product (hand-curated,
 * or AI-drafted then human-reviewed into the CSV) - nothing is lifted from any third-party or
 * competitor food database. The AI-drafting step, when used, writes candidates into the CSV for
 * review; only the reviewed CSV is ever loaded here, which is why this script stays a pure loader
 * (dependency-light, pg only) exactly like backfill-diet-class.ts and migrate.ts.
 *
 * Each row maps one alias -> one indb food code. Rows whose food_code is not present in the real
 * indb `food` table are skipped with a warning (keeps the load safe and self-correcting if indb is
 * reloaded with a changed code set). Safe to re-run: always an UPSERT on (food_code, alias, lang).
 *
 * CSV columns: food_code,alias,lang,source   (source in curated|ai_reviewed|user)
 * Usage: DATABASE_URL=postgresql://user:pass@host:port/db pnpm seed:aliases
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const csvPath = join(here, "data", "food-alias.csv");

interface AliasRow {
  foodCode: string;
  alias: string;
  lang: string;
  source: string;
}

const VALID_SOURCES = new Set(["curated", "ai_reviewed", "user"]);

function parseCsv(text: string): AliasRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const [header, ...rows] = lines;
  if (header !== "food_code,alias,lang,source") {
    throw new Error(`Unexpected CSV header: ${header}`);
  }
  return rows.map((line, i) => {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length !== 4) {
      throw new Error(`Row ${i + 2}: expected 4 columns, got ${parts.length} (${line})`);
    }
    const [foodCode, alias, lang, source] = parts;
    if (!VALID_SOURCES.has(source)) {
      throw new Error(`Row ${i + 2}: invalid source '${source}'`);
    }
    return { foodCode, alias, lang, source };
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const aliases = parseCsv(readFileSync(csvPath, "utf8"));
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const knownCodes = new Set(
      (await client.query<{ code: string }>("SELECT code FROM food")).rows.map((r) => r.code),
    );

    let loaded = 0;
    let skipped = 0;
    for (const row of aliases) {
      if (!knownCodes.has(row.foodCode)) {
        console.warn(`skip alias '${row.alias}' -> unknown food_code '${row.foodCode}'`);
        skipped += 1;
        continue;
      }
      await client.query(
        `INSERT INTO app.food_alias (food_code, alias, lang, source)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (food_code, alias, lang) DO UPDATE SET source = EXCLUDED.source`,
        [row.foodCode, row.alias, row.lang, row.source],
      );
      loaded += 1;
    }

    console.log(`loaded ${loaded} aliases${skipped ? `, skipped ${skipped} (unknown code)` : ""}.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
