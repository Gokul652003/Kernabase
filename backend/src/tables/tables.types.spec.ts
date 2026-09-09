import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRowCursor, encodeRowCursor } from '@/tables/tables.types';

test('row cursors round trip primary-key values', () => {
  const cursor = encodeRowCursor('id', '6f30801d-7724-4f7e-bf8c-ff9e611e4876');
  assert.deepEqual(decodeRowCursor(cursor), { column: 'id', value: '6f30801d-7724-4f7e-bf8c-ff9e611e4876' });
});

test('numeric and null cursor values survive encoding', () => {
  assert.deepEqual(decodeRowCursor(encodeRowCursor('id', 42)), { column: 'id', value: 42 });
  assert.deepEqual(decodeRowCursor(encodeRowCursor('id', null)), { column: 'id', value: null });
});

test('malformed cursors are rejected rather than silently ignored', () => {
  assert.throws(() => decodeRowCursor('not-json'), /Invalid row cursor/);
  assert.throws(() => decodeRowCursor(Buffer.from('{}').toString('base64url')), /Invalid row cursor/);
});
