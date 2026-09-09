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

export interface TableInfo {
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface ProjectConnectionTarget {
  host: string;
  port: number;
  database: string;
  user: string;
}

export interface ProjectConnectionTarget {
  host: string;
  port: number;
  database: string;
  user: string;
}

export interface Project {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  dbUser: string;
  isManaged: boolean;
  mcpEnabled: boolean;
  mcpAllowWrite: boolean;
  mcpAllowSchema: boolean;
  createdAt: string;
  /** Null when the database is only reachable through the studio and MCP. */
  connection: ProjectConnectionTarget | null;
}

/** PostgreSQL's default port; the backend assumes it too when none is sent. */
export const DEFAULT_POSTGRES_PORT = 5432;

export interface ExistingProjectDraft {
  mode: 'existing';
  name: string;
  host: string;
  port: number;
  database: string;
  dbUser: string;
  dbPassword: string;
}

export interface ManagedProjectDraft {
  mode: 'managed';
  name: string;
}

export type NewProjectDraft = ExistingProjectDraft | ManagedProjectDraft;

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  is_identity: boolean;
  is_primary_key: boolean;
}

export interface RowsResponse {
  rows: Record<string, unknown>[];
  total: number | null;
  nextCursor?: string;
}

export interface SqlResult {
  rows: Record<string, unknown>[];
  fields: string[];
  rowCount: number;
}

export const FILTER_OPS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: 'contains' },
  { value: 'is_null', label: 'is null' },
  { value: 'is_not_null', label: 'is not null' },
] as const;

export type FilterOpValue = (typeof FILTER_OPS)[number]['value'];

export interface RowFilter {
  column: string;
  op: FilterOpValue;
  value: string;
}

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export interface RowSort {
  column: string;
  direction: SortDirection;
}

export interface NewColumnDraft {
  name: string;
  type: ColumnType;
  primaryKey: boolean;
  nullable: boolean;
  autoGenerate: boolean;
}

export const AUTO_GENERATE_TYPES: ColumnType[] = ['integer', 'bigint', 'smallint', 'uuid'];

export interface AddColumnDraft {
  name: string;
  type: ColumnType;
  nullable: boolean;
  autoGenerate: boolean;
  defaultValue?: string;
}

/** Only the fields that actually changed are sent, so nothing is altered by accident. */
export interface AlterColumnPatch {
  name?: string;
  type?: ColumnType;
  nullable?: boolean;
  defaultValue?: string;
  dropDefault?: boolean;
}

/** Column defaults PostgreSQL evaluates per row, rather than storing as text. */
export const DEFAULT_EXPRESSIONS = ['now()', 'current_timestamp', 'current_date', 'gen_random_uuid()', 'true', 'false', 'null'];

export const POLICY_COMMANDS = ['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
export type PolicyCommand = (typeof POLICY_COMMANDS)[number];

export interface PolicyInfo {
  name: string;
  permissive: 'PERMISSIVE' | 'RESTRICTIVE';
  roles: string[];
  command: PolicyCommand;
  using: string | null;
  withCheck: string | null;
}

export interface RlsStatus {
  enabled: boolean;
}

export interface NewPolicyDraft {
  name: string;
  command: PolicyCommand;
  roles: string;
  using: string;
  withCheck: string;
}
