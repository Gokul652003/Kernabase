import test from 'node:test';
import assert from 'node:assert/strict';
import { AppConfig } from '@/config/app-config.service';

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const previous = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('integer environment values are validated', () => {
  withEnv({ PORT: 'invalid' }, () => assert.throws(() => new AppConfig(), /PORT must be a positive integer/));
  withEnv({ PORT: '-1' }, () => assert.throws(() => new AppConfig(), /PORT must be a positive integer/));
  withEnv({ PORT: '8080' }, () => assert.equal(new AppConfig().port, 8080));
});

test('production refuses the insecure development secrets', () => {
  withEnv({ NODE_ENV: 'production', STUDIO_JWT_SECRET: undefined, STUDIO_SECRET: undefined }, () => {
    assert.throws(() => new AppConfig(), /STUDIO_JWT_SECRET is required/);
  });
});

test('safety limits have bounded defaults', () => {
  const config = new AppConfig();
  assert.equal(config.tenantStatementTimeoutMs, 15000);
  assert.equal(config.sqlMaxRows, 10000);
  assert.equal(config.http.authRateLimit, 20);
  assert.deepEqual(config.http.corsOrigins, ['http://localhost:5173']);
});

test('CORS origins parse as a trimmed, non-empty list', () => {
  withEnv({ CORS_ORIGINS: 'https://a.example , https://b.example ,' }, () => {
    assert.deepEqual(new AppConfig().http.corsOrigins, ['https://a.example', 'https://b.example']);
  });
});
