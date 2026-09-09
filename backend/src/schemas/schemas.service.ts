import { ApplicationError } from '@/common/errors/application.error';
import { Inject, Injectable } from '@nestjs/common';
import { PROJECT_DATABASE, ProjectDatabase } from '@/db/tenant/database.ports';
import { SchemasApplication } from '@/schemas/schemas-service.port';

@Injectable()
export class SchemasService implements SchemasApplication {
  constructor(@Inject(PROJECT_DATABASE) private readonly db: ProjectDatabase) {}

  async list(): Promise<string[]> {
    const { rows } = await this.db.query<{ nspname: string }>(
      `SELECT nspname FROM pg_namespace
       WHERE nspname NOT IN ('pg_catalog', 'information_schema', '_studio')
         AND nspname NOT LIKE 'pg\\_toast%'
         AND nspname NOT LIKE 'pg\\_temp%'
       ORDER BY (nspname = 'public') DESC, nspname`,
    );
    return rows.map((r) => r.nspname);
  }

  async create(name: string): Promise<void> {
    try {
      await this.db.query(`CREATE SCHEMA ${this.db.quoteIdent(name)}`);
    } catch (err) {
      throw ApplicationError.fromDriver(err);
    }
  }

  // No CASCADE: fails with Postgres's own clear error if the schema still has objects
  // in it, same "explicit over implicit" tradeoff as table drop.
  async drop(name: string): Promise<void> {
    try {
      await this.db.query(`DROP SCHEMA ${this.db.quoteIdent(name)}`);
    } catch (err) {
      throw ApplicationError.fromDriver(err);
    }
  }
}
