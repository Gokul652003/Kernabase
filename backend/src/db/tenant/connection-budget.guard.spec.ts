import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import type { AppConfig } from '@/config/app-config.service';
import { ConnectionBudgetGuard } from '@/db/tenant/connection-budget.guard';

function settings(values: Record<string, string | undefined>): Pool {
  return {
    query: async (_sql: string, params?: unknown[]) => {
      const name = (params?.[0] as string) ?? '';
      const setting = values[name];
      return { rows: setting === undefined ? [] : [{ setting }] };
    },
  } as unknown as Pool;
}

function config(budget: number, controlPool = 10): AppConfig {
  return {
    tenantPools: { connectionBudget: budget },
    postgres: { max: controlPool },
  } as AppConfig;
}

test('a budget the server can serve starts cleanly', async () => {
  const guard = new ConnectionBudgetGuard(settings({ max_connections: '120', superuser_reserved_connections: '3' }), config(100));
  await guard.onModuleInit();
});

// This is the case that previously failed only under load, as a raw driver error.
test('a budget larger than max_connections fails at boot, naming both numbers', async () => {
  const guard = new ConnectionBudgetGuard(settings({ max_connections: '100', superuser_reserved_connections: '3' }), config(300));
  await assert.rejects(() => guard.onModuleInit(), (error: unknown) => {
    const message = (error as Error).message;
    assert.match(message, /310/, 'should state what this process may open');
    assert.match(message, /97/, 'should state what the server allows');
    assert.match(message, /TENANT_POOL_CONNECTION_BUDGET=300/);
    assert.match(message, /max_connections=100/);
    return true;
  });
});

test('the control pool counts toward the total, not just tenant pools', async () => {
  const tight = new ConnectionBudgetGuard(settings({ max_connections: '100', superuser_reserved_connections: '0' }), config(95, 10));
  await assert.rejects(() => tight.onModuleInit(), /105/);

  const fits = new ConnectionBudgetGuard(settings({ max_connections: '100', superuser_reserved_connections: '0' }), config(90, 10));
  await fits.onModuleInit();
});

test('reserved superuser slots are excluded from what is usable', async () => {
  // 100 - 10 reserved = 90 usable; a total of exactly 90 fits, 91 does not.
  const exact = new ConnectionBudgetGuard(settings({ max_connections: '100', superuser_reserved_connections: '10' }), config(80, 10));
  await exact.onModuleInit();

  const over = new ConnectionBudgetGuard(settings({ max_connections: '100', superuser_reserved_connections: '10' }), config(81, 10));
  await assert.rejects(() => over.onModuleInit(), /91/);
});

test('an unreadable setting defaults the reservation rather than failing', async () => {
  const guard = new ConnectionBudgetGuard(settings({ max_connections: '120' }), config(100));
  await guard.onModuleInit();
});

// Readiness already reports an unreachable control plane; refusing to boot as well
// would turn a transient database outage into a crash loop.
test('an unreachable server does not stop startup', async () => {
  const unreachable = { query: async () => { throw new Error('ECONNREFUSED'); } } as unknown as Pool;
  await new ConnectionBudgetGuard(unreachable, config(300)).onModuleInit();
});
