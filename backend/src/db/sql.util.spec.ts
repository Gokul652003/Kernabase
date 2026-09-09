import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSchema, qualifiedName, quoteIdentifier } from '@/db/sql.util';

test('identifiers are wrapped in double quotes', () => {
  assert.equal(quoteIdentifier('users'), '"users"');
});

test('embedded double quotes are escaped, closing an injection route', () => {
  assert.equal(quoteIdentifier('we"ird'), '"we""ird"');
  assert.equal(quoteIdentifier('a"; DROP TABLE users; --'), '"a""; DROP TABLE users; --"');
});

test('identifiers PostgreSQL cannot represent are rejected', () => {
  assert.throws(() => quoteIdentifier(''), /Invalid identifier/);
  assert.throws(() => quoteIdentifier('a'.repeat(64)), /Invalid identifier/);
  assert.throws(() => quoteIdentifier('nul\0byte'), /Invalid identifier/);
});

test('a missing or blank schema falls back to public', () => {
  assert.equal(normalizeSchema(undefined), 'public');
  assert.equal(normalizeSchema('   '), 'public');
  assert.equal(normalizeSchema(' reporting '), 'reporting');
});

test('qualified names quote both components', () => {
  assert.equal(qualifiedName('public', 'users'), '"public"."users"');
});
