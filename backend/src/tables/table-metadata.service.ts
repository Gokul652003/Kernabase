import { Inject, Injectable } from '@nestjs/common';
import { PROJECT_DATABASE, ProjectDatabase } from '@/db/tenant/database.ports';
import { ColumnInfo } from '@/tables/tables.types';

@Injectable()
export class TableMetadataService {
  constructor(@Inject(PROJECT_DATABASE) private readonly db: ProjectDatabase) {}

  async exists(table: string, schema: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'`,
      [schema, table],
    );
    return rows.length > 0;
  }

  async columns(table: string, schema: string): Promise<ColumnInfo[]> {
    const { rows } = await this.db.query<ColumnInfo>(
      `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
              (c.is_identity = 'YES') AS is_identity,
              EXISTS (
                SELECT 1 FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1
                  AND tc.table_name = $2 AND kcu.column_name = c.column_name
              ) AS is_primary_key
       FROM information_schema.columns c
       WHERE c.table_schema = $1 AND c.table_name = $2 ORDER BY c.ordinal_position`,
      [schema, table],
    );
    return rows;
  }
}
