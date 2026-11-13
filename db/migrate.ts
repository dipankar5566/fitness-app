/**
 * Minimal, dependency-light migration runner. Applies every .sql file in migrations/,
 * in filename order, inside a transaction, tracking what has already run in
 * app.schema_migrations. Safe to re-run: migration files themselves use
 * CREATE ... IF NOT EXISTS, and already-applied files are skipped by name.
 *
 * Usage: DATABASE_URL=postgresql://user:pass@host:port/db pnpm migrate
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS app");
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.schema_migrations (
        filename    text PRIMARY KEY,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query("SELECT filename FROM app.schema_migrations")).rows.map((r) => r.filename),
    );

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip    ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      console.log(`apply   ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO app.schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
