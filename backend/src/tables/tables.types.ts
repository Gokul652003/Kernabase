export interface TableInfo {
  name: string;
}

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

export const FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'is_null', 'is_not_null'] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export interface RowFilter {
  column: string;
  op: string;
  value?: string;
}

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export interface RowSort {
  column: string;
  direction: SortDirection;
}

export function encodeRowCursor(column: string, value: unknown): string {
  return Buffer.from(JSON.stringify({ column, value }), 'utf8').toString('base64url');
}

export function decodeRowCursor(cursor: string): { column: string; value: unknown } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof parsed.column !== 'string' || !Object.prototype.hasOwnProperty.call(parsed, 'value')) throw new Error();
    return { column: parsed.column, value: parsed.value };
  } catch {
    throw new Error('Invalid row cursor');
  }
}
