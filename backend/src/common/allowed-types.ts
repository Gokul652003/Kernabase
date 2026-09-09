export const ALLOWED_COLUMN_TYPES = [
  'text',
  'varchar',
  'integer',
  'bigint',
  'smallint',
  'numeric',
  'real',
  'double precision',
  'boolean',
  'date',
  'timestamp',
  'timestamptz',
  'uuid',
  'jsonb',
  'json',
] as const;

export type ColumnType = (typeof ALLOWED_COLUMN_TYPES)[number];
