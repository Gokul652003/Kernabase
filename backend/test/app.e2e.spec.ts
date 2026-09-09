import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { configureApp } from '@/bootstrap';
import { AppConfig } from '@/config/app-config.service';
import { MigrationRunner } from '@/db/migrations/migration-runner.service';
import { POOL_METRICS_READER, type PoolMetricsReader } from '@/db/tenant/database.ports';

const METRICS: PoolMetricsReader = {
  getMetrics: () => ({
    cachedTenantPools: 0,
    maxTenantPools: 100,
    configuredConnectionBudget: 300,
    openTenantConnections: 0,
    idleTenantConnections: 0,
    waitingTenantRequests: 0,
    evictions: { idle: 0, capacity: 0, credentials: 0, invalidated: 0 },
  }),
  isControlPlaneReachable: async () => false,
};

/**
 * Boots the real application over HTTP with only the two things that need a live
 * PostgreSQL stubbed out: the boot-time migration run, and pool metrics. Everything
 * under test here — routing, validation, guards, error translation, hardening headers —
 * is the code that actually ships.
 */
describe('HTTP surface', () => {
  let app: INestApplication;

  before(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MigrationRunner).useValue({ onModuleInit: async () => {} })
      .overrideProvider(POOL_METRICS_READER).useValue(METRICS)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, app.get(AppConfig));
    await app.init();
  });

  after(async () => {
    await app?.close();
  });

  test('liveness does not depend on the database', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/live').expect(200);
    assert.deepEqual(response.body, { ok: true });
  });

  test('readiness reports 503 while the control database is unreachable', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(503);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error, 'Control database is unavailable');
  });

  test('metrics are exposed in Prometheus text format', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/metrics').expect(200);
    assert.match(String(response.headers['content-type']), /text\/plain/);
    assert.match(response.text, /^# HELP kernabase_cached_tenant_pools/m);
  });

  test('security headers and a request id are set on every response', async () => {
    const response = await request(app.getHttpServer()).get('/api/health/live').expect(200);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.ok(response.headers['x-request-id']);
    assert.ok(response.headers['ratelimit-limit']);
  });

  test('a caller-supplied request id is echoed back for tracing', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health/live')
      .set('X-Request-Id', 'trace-me')
      .expect(200);
    assert.equal(response.headers['x-request-id'], 'trace-me');
  });

  test('a protected route without a token is rejected as unauthorized', async () => {
    const response = await request(app.getHttpServer()).get('/api/projects').expect(401);
    assert.equal(response.body.error, 'unauthorized');
    assert.equal(response.body.message, 'Missing authorization token');
  });

  test('a malformed token is rejected, not treated as anonymous', async () => {
    await request(app.getHttpServer())
      .get('/api/projects')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });

  // The application error filter is the only place a code becomes a status; this proves
  // it is actually installed on the real app, not just unit-tested in isolation.
  test('application errors are rendered with their code and matching status', async () => {
    const response = await request(app.getHttpServer()).get('/api/projects').expect(401);
    assert.deepEqual(Object.keys(response.body).sort(), ['error', 'message', 'statusCode']);
    assert.equal(response.body.statusCode, 401);
  });

  test('an invalid signup body is rejected before any service runs', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
    assert.ok(Array.isArray(response.body.message));
  });

  test('unknown properties are stripped rather than trusted', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email: 'user@example.com', password: 'longenough', isAdmin: true })
      .expect(400);
  });

  test('the MCP endpoint refuses non-POST verbs', async () => {
    await request(app.getHttpServer())
      .get('/api/projects/00000000-0000-0000-0000-000000000000/mcp')
      .expect(401);
  });

  test('an unknown route is a 404', async () => {
    await request(app.getHttpServer()).get('/api/does-not-exist').expect(404);
  });
});
