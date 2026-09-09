import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationError } from '@/common/errors/application.error';
import { ConnectionTargetPolicy } from '@/projects/connection-target.policy';
import type { AppConfig } from '@/config/app-config.service';

function policy(overrides: { host?: string; port?: number; database?: string; allowPrivate?: boolean } = {}) {
  return new ConnectionTargetPolicy({
    postgres: {
      host: overrides.host ?? '127.0.0.1',
      port: overrides.port ?? 5432,
      database: overrides.database ?? 'mydb',
    },
    allowPrivateDatabaseHosts: overrides.allowPrivate ?? false,
  } as AppConfig);
}

async function refusal(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, 'bad_request');
    return error.message;
  }
  throw new Error('expected the host to be refused');
}

test('a public database host is allowed', async () => {
  await policy().assertAllowed('203.0.113.10', 5432, 'app');
});

// This is the attack the policy exists for: pointing the studio at its own metadata
// database, whose tables hold every user's password hash and encrypted credentials.
test("the studio's own metadata database is refused, even with internal hosts allowed", async () => {
  const permissive = policy({ host: '127.0.0.1', port: 5432, database: 'mydb', allowPrivate: true });
  for (const host of ['127.0.0.1', 'localhost', '::ffff:127.0.0.1']) {
    assert.match(await refusal(() => permissive.assertAllowed(host, 5432, 'mydb')), /own metadata database/, host);
  }
});

// Blocking the whole server would leave a single-machine install unable to add any
// project at all — which is what a blanket host match did.
test('another database on the same server is allowed when internal hosts are enabled', async () => {
  const permissive = policy({ host: '127.0.0.1', port: 5432, database: 'mydb', allowPrivate: true });
  await permissive.assertAllowed('127.0.0.1', 5432, 'my_app');
  await permissive.assertAllowed('localhost', 5432, 'my_app');
});

test('a different port on the same host is not the control plane', async () => {
  const permissive = policy({ host: '127.0.0.1', port: 5432, database: 'mydb', allowPrivate: true });
  await permissive.assertAllowed('127.0.0.1', 5433, 'mydb');
});

test('internal addresses are refused by default, and say how to allow them', async () => {
  for (const host of ['127.0.0.1', '10.0.0.5', '192.168.1.20']) {
    const message = await refusal(() => policy().assertAllowed(host, 5432, 'app'));
    assert.match(message, /Refusing to connect/, host);
    assert.match(message, /ALLOW_PRIVATE_DATABASE_HOSTS=true/, 'a self-hoster needs to know the escape hatch');
  }
});

test('internal addresses are allowed once explicitly enabled', async () => {
  const permissive = policy({ allowPrivate: true });
  for (const host of ['127.0.0.1', '10.0.0.5', '192.168.1.20', '[::1]']) {
    await permissive.assertAllowed(host, 6000, 'app');
  }
});

// No flag opens these: they are never a PostgreSQL server, and link-local carries the
// cloud metadata endpoint.
test('unspecified, link-local and multicast stay refused even when enabled', async () => {
  const permissive = policy({ allowPrivate: true });
  assert.match(await refusal(() => permissive.assertAllowed('0.0.0.0', 5432, 'app')), /unspecified/);
  assert.match(await refusal(() => permissive.assertAllowed('169.254.169.254', 80, 'app')), /link-local/);
  assert.match(await refusal(() => permissive.assertAllowed('224.0.0.1', 5432, 'app')), /multicast/);
});

test('a host that cannot be resolved is refused rather than dialled', async () => {
  assert.match(await refusal(() => policy().assertAllowed('no-such-host.invalid', 5432, 'app')), /Could not resolve host/);
});

test('an empty host is rejected before any lookup', async () => {
  assert.match(await refusal(() => policy().assertAllowed('   ', 5432, 'app')), /host is required/);
});
