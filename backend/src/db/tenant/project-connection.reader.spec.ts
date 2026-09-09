import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationError } from '@/common/errors/application.error';
import type { ProjectRepository } from '@/db/control-plane/control-plane.ports';
import { ProjectConnectionReaderAdapter } from '@/db/tenant/project-connection.reader';

const CONNECTION = {
  id: 'project-1', host: 'localhost', port: 5432, database: 'tenant', dbUser: 'tenant', dbPassword: 'secret',
};

function reader(connectionInfo: ProjectRepository['connectionInfo']) {
  return new ProjectConnectionReaderAdapter({ connectionInfo } as ProjectRepository);
}

test('an owned project resolves to its decrypted connection', async () => {
  const resolved = await reader(async () => CONNECTION).getConnectionInfo('project-1', 'user-1');
  assert.deepEqual(resolved, CONNECTION);
});

test('the owner is always part of the lookup, never assumed', async () => {
  const seen: unknown[] = [];
  await reader(async (projectId, userId) => { seen.push([projectId, userId]); return CONNECTION; })
    .getConnectionInfo('project-1', 'user-1');
  assert.deepEqual(seen, [['project-1', 'user-1']]);
});

// Reporting someone else's project as "not found" rather than "forbidden" keeps the
// endpoint from confirming which project ids exist.
test('a project the user does not own reads as not found', async () => {
  await assert.rejects(
    () => reader(async () => null).getConnectionInfo('project-1', 'user-2'),
    (error: unknown) => error instanceof ApplicationError && error.code === 'not_found',
  );
});

test('an unauthenticated request never reaches the database', async () => {
  let queried = false;
  await assert.rejects(
    () => reader(async () => { queried = true; return CONNECTION; }).getConnectionInfo('project-1', undefined),
    (error: unknown) => error instanceof ApplicationError && error.code === 'forbidden',
  );
  assert.equal(queried, false);
});
