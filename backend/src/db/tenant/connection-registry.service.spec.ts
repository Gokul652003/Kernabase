import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationError } from '@/common/errors/application.error';
import { ConnectionRegistry } from '@/db/tenant/connection-registry.service';
import type { AppConfig } from '@/config/app-config.service';
import type { ProjectConnectionInfo } from '@/db/tenant/database.ports';

function config(overrides: Record<string, number> = {}): AppConfig {
  return {
    postgres: { host: 'localhost', port: 1, user: 'x', password: 'x', database: 'x', max: 1 },
    tenantStatementTimeoutMs: 1000,
    tenantPools: {
      maxPools: 2,
      maxConnectionsPerPool: 1,
      connectionBudget: 2,
      poolIdleTtlMs: 60000,
      sweepIntervalMs: 60000,
      connectionTimeoutMs: 10,
      connectionIdleTimeoutMs: 10,
      ...overrides,
    },
  } as unknown as AppConfig;
}

function info(id: string, password = 'secret'): ProjectConnectionInfo {
  return { id, host: 'localhost', port: 1, database: id, dbUser: id, dbPassword: password };
}

test('the tenant pool cache is bounded and evicts the least recently used pool', async () => {
  const registry = new ConnectionRegistry(config());
  registry.getProjectPool(info('one'));
  registry.getProjectPool(info('two'));
  registry.getProjectPool(info('one'));
  registry.getProjectPool(info('three'));

  const metrics = registry.getMetrics();
  assert.equal(metrics.cachedTenantPools, 2);
  assert.equal(metrics.maxTenantPools, 2);
  assert.equal(metrics.evictions.capacity, 1);
  await registry.onModuleDestroy();
});

test('the same project reuses its pool', async () => {
  const registry = new ConnectionRegistry(config());
  assert.equal(registry.getProjectPool(info('one')), registry.getProjectPool(info('one')));
  assert.equal(registry.getMetrics().cachedTenantPools, 1);
  await registry.onModuleDestroy();
});

test('changed credentials replace a cached pool instead of failing auth forever', async () => {
  const registry = new ConnectionRegistry(config());
  const first = registry.getProjectPool(info('one', 'old'));
  const second = registry.getProjectPool(info('one', 'new'));

  assert.notEqual(first, second);
  assert.equal(registry.getMetrics().evictions.credentials, 1);
  await registry.onModuleDestroy();
});

test('invalidating a project drops its pool', async () => {
  const registry = new ConnectionRegistry(config());
  registry.getProjectPool(info('one'));
  await registry.invalidateProject('one');

  const metrics = registry.getMetrics();
  assert.equal(metrics.cachedTenantPools, 0);
  assert.equal(metrics.evictions.invalidated, 1);
  await registry.onModuleDestroy();
});

// Shedding load is correct here: handing out an unbounded number of pools would
// exhaust PostgreSQL's connection limit for every tenant at once.
test('exhausted capacity is reported as service unavailable', async () => {
  const registry = new ConnectionRegistry(config({ maxPools: 1, connectionBudget: 1, maxConnectionsPerPool: 1 }));
  const pool = registry.getProjectPool(info('one'));
  await pool.connect().catch(() => {});
  Object.defineProperty(pool, 'totalCount', { get: () => 1 });
  Object.defineProperty(pool, 'idleCount', { get: () => 0 });

  assert.throws(
    () => registry.getProjectPool(info('two')),
    (error: unknown) => error instanceof ApplicationError && error.code === 'service_unavailable',
  );
  await registry.onModuleDestroy();
});
