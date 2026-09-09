import { ApplicationError } from '@/common/errors/application.error';
import { Inject, Injectable } from '@nestjs/common';
import { PROJECT_DATABASE, ProjectDatabase } from '@/db/tenant/database.ports';
import { AppConfig } from '@/config/app-config.service';
import { SqlApplication, SqlResult } from '@/sql/sql-service.port';

@Injectable()
export class SqlService implements SqlApplication {
  constructor(@Inject(PROJECT_DATABASE) private readonly db: ProjectDatabase, private readonly config: AppConfig) {}

  async run(query: string): Promise<SqlResult> {
    try {
      const result = await this.db.query(query);
      if (result.rows.length > this.config.sqlMaxRows) {
        throw ApplicationError.payloadTooLarge(`Query returned more than ${this.config.sqlMaxRows} rows; add a LIMIT clause`);
      }
      const responseBytes = Buffer.byteLength(JSON.stringify(result.rows));
      if (responseBytes > this.config.sqlMaxResponseBytes) {
        throw ApplicationError.payloadTooLarge(`Query response exceeds ${this.config.sqlMaxResponseBytes} bytes`);
      }
      return {
        rows: result.rows,
        fields: (result.fields || []).map((f) => f.name),
        rowCount: result.rowCount ?? 0,
      };
    } catch (err) {
      throw ApplicationError.fromDriver(err);
    }
  }
}
