import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationError } from '@/common/errors/application.error';
import { buildRowQuery, MAX_ROW_LIMIT, parseRowSort } from '@/tables/row-query.builder';
import { encodeRowCursor, type ColumnInfo } from '@/tables/tables.types';

const quote = (name: string): string => `"${name.replace(/"/g, '""')}"`;

function column(name: string, isPrimaryKey = false): ColumnInfo {
  return {
    column_name: name,
    data_type: 'text',
    is_nullable: 'YES',
    column_default: null,
    is_identity: false,
    is_primary_key: isPrimaryKey,
  };
}

const columns = [column('id', true), column('email'), column('age')];

function build(overrides: Partial<Parameters<typeof buildRowQuery>[0]> = {}) {
  return buildRowQuery({ columns, limit: 50, offset: 0, ...overrides }, quote);
}

test('an unfiltered request produces no WHERE clause', () => {
  const query = build();
  assert.equal(query.whereSql, '');
  assert.equal(query.countWhereSql, '');
  assert.deepEqual(query.whereParams, []);
});

test('comparison filters are parameterized, never interpolated', () => {
  const query = build({ filters: [{ column: 'age', op: 'gte', value: '18' }] });
  assert.equal(query.whereSql, 'WHERE "age" >= $1');
  assert.deepEqual(query.whereParams, ['18']);
});

test('placeholders stay in order across several filters', () => {
  const query = build({
    filters: [
      { column: 'age', op: 'gt', value: '18' },
      { column: 'email', op: 'contains', value: 'example' },
      { column: 'id', op: 'is_not_null' },
    ],
  });
  assert.equal(
    query.whereSql,
    `WHERE "age" > $1 AND "email"::text ILIKE '%' || $2 || '%' AND "id" IS NOT NULL`,
  );
  assert.deepEqual(query.whereParams, ['18', 'example']);
});

test('null checks consume no parameter slot', () => {
  const query = build({ filters: [{ column: 'email', op: 'is_null' }, { column: 'age', op: 'eq', value: '1' }] });
  assert.equal(query.whereSql, 'WHERE "email" IS NULL AND "age" = $1');
  assert.deepEqual(query.whereParams, ['1']);
});

test('a column that is not on the table is rejected before reaching SQL', () => {
  assert.throws(
    () => build({ filters: [{ column: 'id; DROP TABLE users', op: 'eq', value: 'x' }] }),
    (error: unknown) => error instanceof ApplicationError && error.code === 'bad_request',
  );
});

test('an unknown operator is rejected', () => {
  assert.throws(
    () => build({ filters: [{ column: 'age', op: 'regex', value: '.*' }] }),
    /Unsupported filter operator/,
  );
});

test('the cursor boundary is excluded from the count query', () => {
  const query = build({
    filters: [{ column: 'age', op: 'gte', value: '18' }],
    cursor: encodeRowCursor('id', 'row-10'),
  });
  assert.equal(query.whereSql, 'WHERE "age" >= $1 AND "id" > $2');
  assert.equal(query.countWhereSql, 'WHERE "age" >= $1', 'a total must not shrink as you page');
  assert.deepEqual(query.whereParams, ['18', 'row-10']);
  assert.deepEqual(query.countParams, ['18']);
});

// Without this, LIMIT/OFFSET paging has undefined order in PostgreSQL and can show the
// same row on two consecutive pages.
test('a table with a primary key is always ordered, even with no sort requested', () => {
  assert.equal(build().orderSql, 'ORDER BY "id" ASC');
});

test('a table with no primary key has nothing sensible to order by', () => {
  const query = buildRowQuery({ columns: [column('a'), column('b')], limit: 10, offset: 0 }, quote);
  assert.equal(query.orderSql, '');
});

test('a composite primary key orders by every key column', () => {
  const query = buildRowQuery(
    { columns: [column('tenant', true), column('id', true), column('note')], limit: 10, offset: 0 },
    quote,
  );
  assert.equal(query.orderSql, 'ORDER BY "tenant" ASC, "id" ASC');
});

test('an ascending sort orders by that column', () => {
  assert.equal(build({ sort: { column: 'email', direction: 'asc' } }).orderSql, 'ORDER BY "email" ASC, "id" ASC');
});

test('a descending sort orders by that column', () => {
  assert.equal(build({ sort: { column: 'email', direction: 'desc' } }).orderSql, 'ORDER BY "email" DESC, "id" ASC');
});

// Ties in a non-unique column would otherwise land in an arbitrary order that can differ
// between two pages of the same query.
test('the primary key breaks ties so paging stays reproducible', () => {
  assert.match(build({ sort: { column: 'age', direction: 'desc' } }).orderSql, /"age" DESC, "id" ASC$/);
});

test('sorting by the primary key does not repeat it as a tiebreaker', () => {
  assert.equal(build({ sort: { column: 'id', direction: 'desc' } }).orderSql, 'ORDER BY "id" DESC');
});

test('the sort column is validated against the table, never interpolated', () => {
  assert.throws(
    () => build({ sort: { column: 'id; DROP TABLE users', direction: 'asc' } }),
    /Unknown sort column/,
  );
});

test('a sort column containing quotes is escaped if it somehow validates', () => {
  const query = buildRowQuery(
    { columns: [column('we"ird'), column('id', true)], limit: 10, offset: 0, sort: { column: 'we"ird', direction: 'asc' } },
    quote,
  );
  assert.equal(query.orderSql, 'ORDER BY "we""ird" ASC, "id" ASC');
});

test('an unsupported sort direction is refused', () => {
  assert.throws(
    () => build({ sort: { column: 'email', direction: 'sideways' as never } }),
    /Unsupported sort direction/,
  );
});

// The cursor boundary is "primary key > last seen", which only holds under that order.
test('a custom sort cannot be combined with cursor paging', () => {
  assert.throws(
    () => build({ cursor: encodeRowCursor('id', 5), sort: { column: 'email', direction: 'desc' } }),
    /Cursor pagination always orders by the primary key/,
  );
});

test('a sort that matches the cursor order is accepted', () => {
  const query = build({ cursor: encodeRowCursor('id', 5), sort: { column: 'id', direction: 'asc' } });
  assert.equal(query.orderSql, 'ORDER BY "id" ASC');
});

test('parseRowSort narrows query-string input', () => {
  assert.equal(parseRowSort(undefined, undefined), undefined);
  assert.equal(parseRowSort(undefined, 'desc'), undefined, 'a direction alone is not a sort');
  assert.deepEqual(parseRowSort('email', undefined), { column: 'email', direction: 'asc' });
  assert.deepEqual(parseRowSort('email', 'desc'), { column: 'email', direction: 'desc' });
  assert.throws(() => parseRowSort('email', 'DESC'), /Unsupported sort direction/);
});

test('a cursor orders by the primary key and ignores any offset', () => {
  const query = build({ offset: 500, cursor: encodeRowCursor('id', 'row-10') });
  assert.equal(query.orderSql, 'ORDER BY "id" ASC');
  assert.equal(query.offset, 0);
  assert.equal(query.cursorColumn, 'id');
});

test('a cursor is refused when the primary key is not a single column', () => {
  assert.throws(
    () => buildRowQuery(
      { columns: [column('a', true), column('b', true)], limit: 10, offset: 0, cursor: encodeRowCursor('a', 1) },
      quote,
    ),
    /exactly one primary-key column/,
  );
});

test('a cursor for a different column is refused', () => {
  assert.throws(() => build({ cursor: encodeRowCursor('email', 'x') }), /does not match the table primary key/);
});

test('a malformed cursor is refused', () => {
  assert.throws(() => build({ cursor: 'not-a-cursor' }), /Invalid row cursor/);
});

test('an empty cursor query parameter means "start at the beginning"', () => {
  for (const cursor of ['', undefined]) {
    const query = build({ cursor, offset: 10 });
    assert.equal(query.cursorColumn, undefined);
    assert.equal(query.whereSql, '');
    assert.equal(query.offset, 10, 'an empty cursor must not suppress the offset');
  }
});

test('limit and offset are clamped to a safe range', () => {
  assert.equal(build({ limit: 10_000 }).limit, MAX_ROW_LIMIT);
  assert.equal(build({ limit: 0 }).limit, 1);
  assert.equal(build({ limit: 10, offset: -5 }).offset, 0);
});
