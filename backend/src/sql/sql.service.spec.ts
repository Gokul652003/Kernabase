import test from 'node:test';
import assert from 'node:assert/strict';
import type { QueryResult } from 'pg';
import { ApplicationError } from '@/common/errors/application.error';
import { SqlService } from '@/sql/sql.service';
import type { AppConfig } from '@/config/app-config.service';
import type { ProjectDatabase } from '@/db/tenant/database.ports';

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return { sqlMaxRows: 2, sqlMaxResponseBytes: 1000, ...overrides } as AppConfig;
}

function db(result: Partial<QueryResult> | (() => never)): ProjectDatabase {
  return {
    query: async () => (typeof result === 'function' ? result() : result) as QueryResult,
    quoteIdent: (name: string) => `"${name}"`,
    transaction: async (work) => work({
      query: async () => (typeof result === 'function' ? result() : result) as QueryResult,
      quoteIdent: (name: string) => `"${name}"`,
    }),
  };
}

test('a successful query returns rows, field names and a row count', async () => {
  const service = new SqlService(db({ rows: [{ id: 1 }], fields: [{ name: 'id' }] as never, rowCount: 1 }), config());
  assert.deepEqual(await service.run('SELECT 1'), { rows: [{ id: 1 }], fields: ['id'], rowCount: 1 });
});

test('an oversized row count is refused rather than streamed to the browser', async () => {
  const service = new SqlService(db({ rows: [{}, {}, {}], fields: [], rowCount: 3 }), config());
  await assert.rejects(
    () => service.run('SELECT *'),
    (error: unknown) => error instanceof ApplicationError && error.code === 'payload_too_large',
  );
});

test('an oversized serialized response is refused even when the row count is small', async () => {
  const service = new SqlService(db({ rows: [{ value: 'large' }], fields: [], rowCount: 1 }), config({ sqlMaxResponseBytes: 4 }));
  await assert.rejects(() => service.run('SELECT *'), /response exceeds/);
});

test('a driver error becomes a bad request carrying PostgreSQL\'s own message', async () => {
  const service = new SqlService(db(() => { throw new Error('syntax error at or near "SELCT"'); }), config());
  await assert.rejects(
    () => service.run('SELCT 1'),
    (error: unknown) => error instanceof ApplicationError
      && error.code === 'bad_request'
      && /syntax error/.test(error.message),
  );
});
