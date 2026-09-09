import { ApplicationError } from '@/common/errors/application.error';
import {
  ColumnInfo,
  decodeRowCursor,
  FILTER_OPS,
  FilterOp,
  RowFilter,
  RowSort,
  SORT_DIRECTIONS,
  SortDirection,
} from '@/tables/tables.types';

export const MAX_ROW_LIMIT = 1000;
export const DEFAULT_ROW_LIMIT = 100;

/** SQL fragment for a filter operator, given the already-quoted column and a `$n` placeholder. */
const COMPARISONS: Record<Exclude<FilterOp, 'is_null' | 'is_not_null' | 'contains'>, string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

export interface RowQueryRequest {
  columns: ColumnInfo[];
  limit: number;
  offset: number;
  filters?: RowFilter[] | undefined;
  cursor?: string | undefined;
  sort?: RowSort | undefined;
}

export interface RowQuery {
  /** WHERE clause including the cursor boundary, or '' when unfiltered. */
  whereSql: string;
  /** WHERE clause excluding the cursor boundary — a total must not shrink as you page. */
  countWhereSql: string;
  /** Always present when the table has a primary key — see `buildOrderBy`. */
  orderSql: string;
  /** Parameters for `whereSql`, in `$1..$n` order. */
  whereParams: unknown[];
  countParams: unknown[];
  limit: number;
  offset: number;
  cursorColumn: string | undefined;
}

/**
 * Compiles a row listing request into SQL fragments.
 *
 * Pure by design: no database, no DI, no transport. Every identifier reaching SQL is
 * either validated against the table's real columns or quoted by `quoteIdent`; every
 * value is parameterized. This is the highest-risk code in the service, so it is kept
 * separately testable.
 */
export function buildRowQuery(request: RowQueryRequest, quoteIdent: (name: string) => string): RowQuery {
  const { columns, filters, cursor } = request;
  const validNames = new Set(columns.map((column) => column.column_name));
  const whereParams: unknown[] = [];
  const conditions: string[] = [];

  for (const filter of filters ?? []) {
    if (!FILTER_OPS.includes(filter.op as FilterOp)) {
      throw ApplicationError.badRequest(`Unsupported filter operator: ${filter.op}`);
    }
    if (!validNames.has(filter.column)) {
      throw ApplicationError.badRequest(`Unknown filter column: ${filter.column}`);
    }
    const column = quoteIdent(filter.column);
    const op = filter.op as FilterOp;

    if (op === 'is_null') {
      conditions.push(`${column} IS NULL`);
    } else if (op === 'is_not_null') {
      conditions.push(`${column} IS NOT NULL`);
    } else if (op === 'contains') {
      conditions.push(`${column}::text ILIKE '%' || $${whereParams.length + 1} || '%'`);
      whereParams.push(filter.value ?? '');
    } else {
      conditions.push(`${column} ${COMPARISONS[op]} $${whereParams.length + 1}`);
      whereParams.push(filter.value);
    }
  }

  // Everything above this point also applies to the COUNT query; the cursor boundary
  // below must not, or the reported total would shrink with every page.
  const filterConditions = [...conditions];
  const countParams = [...whereParams];

  let cursorColumn: string | undefined;
  // An absent cursor and an empty `?cursor=` mean the same thing: start at the beginning.
  if (cursor) {
    const primaryKeys = columns.filter((column) => column.is_primary_key);
    const primaryKey = primaryKeys[0];
    if (primaryKeys.length !== 1 || !primaryKey) {
      throw ApplicationError.badRequest('Cursor pagination requires exactly one primary-key column');
    }
    let decoded: { column: string; value: unknown };
    try {
      decoded = decodeRowCursor(cursor);
    } catch {
      throw ApplicationError.badRequest('Invalid row cursor');
    }
    cursorColumn = primaryKey.column_name;
    if (decoded.column !== cursorColumn) {
      throw ApplicationError.badRequest('Cursor does not match the table primary key');
    }
    conditions.push(`${quoteIdent(cursorColumn)} > $${whereParams.length + 1}`);
    whereParams.push(decoded.value);
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    countWhereSql: filterConditions.length > 0 ? `WHERE ${filterConditions.join(' AND ')}` : '',
    orderSql: buildOrderBy(columns, request.sort, cursorColumn, quoteIdent),
    whereParams,
    countParams,
    limit: Math.min(Math.max(request.limit, 1), MAX_ROW_LIMIT),
    // A cursor supersedes an offset: paging by both at once silently skips rows.
    offset: cursorColumn ? 0 : Math.max(request.offset, 0),
    cursorColumn,
  };
}

/**
 * Chooses the row order.
 *
 * There is deliberately no "unordered" case when the table has a primary key. A
 * `SELECT ... LIMIT/OFFSET` with no ORDER BY has undefined order in PostgreSQL, so
 * paging through one can show the same row twice or skip one entirely whenever the
 * planner or the heap changes underneath. Falling back to the primary key makes offset
 * paging reproducible.
 *
 * A requested sort is followed by the primary key for the same reason: sorting by a
 * non-unique column alone leaves ties in an arbitrary order that can differ per page.
 */
function buildOrderBy(
  columns: ColumnInfo[],
  sort: RowSort | undefined,
  cursorColumn: string | undefined,
  quoteIdent: (name: string) => string,
): string {
  const primaryKeys = columns.filter((column) => column.is_primary_key).map((column) => column.column_name);

  // Cursor paging walks the primary key in ascending order; any other order would make
  // the "> last seen value" boundary skip or repeat rows.
  if (cursorColumn) {
    if (sort && !(sort.column === cursorColumn && sort.direction === 'asc')) {
      throw ApplicationError.badRequest(
        'Cursor pagination always orders by the primary key ascending. Drop the sort, or page with offset instead.',
      );
    }
    return `ORDER BY ${quoteIdent(cursorColumn)} ASC`;
  }

  const terms: string[] = [];
  if (sort) {
    if (!columns.some((column) => column.column_name === sort.column)) {
      throw ApplicationError.badRequest(`Unknown sort column: ${sort.column}`);
    }
    if (!SORT_DIRECTIONS.includes(sort.direction)) {
      throw ApplicationError.badRequest(`Unsupported sort direction: ${sort.direction}`);
    }
    terms.push(`${quoteIdent(sort.column)} ${sort.direction === 'desc' ? 'DESC' : 'ASC'}`);
  }
  for (const key of primaryKeys) {
    if (key !== sort?.column) terms.push(`${quoteIdent(key)} ASC`);
  }

  return terms.length > 0 ? `ORDER BY ${terms.join(', ')}` : '';
}

/** Narrows raw query-string input to a sort, or `undefined` when none was requested. */
export function parseRowSort(column: string | undefined, direction: string | undefined): RowSort | undefined {
  if (!column) return undefined;
  if (direction !== undefined && !SORT_DIRECTIONS.includes(direction as SortDirection)) {
    throw ApplicationError.badRequest(`Unsupported sort direction: ${direction}`);
  }
  return { column, direction: (direction as SortDirection) ?? 'asc' };
}
