import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, type QueryResultRow } from "pg";

/**
 * Thin wrapper around a pg Pool. Deliberately not an ORM: the indb schema (apps/api does not own it,
 * db/0001_indb.sql does) is queried with plain SQL, and the app schema is simple enough that an ORM
 * would add more ceremony than value at this stage (ARCHITECTURE.md section 2 leaves the ORM choice open;
 * this starts with plain node-postgres and can move to Drizzle later without changing callers much,
 * since callers only see `query`).
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>("DATABASE_URL");
    this.pool = new Pool({ connectionString });
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
