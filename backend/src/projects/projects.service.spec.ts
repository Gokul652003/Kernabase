import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationError } from '@/common/errors/application.error';
import { ProjectsService } from '@/projects/projects.service';
import { CreateProjectDto, DEFAULT_POSTGRES_PORT } from '@/projects/dto/create-project.dto';
import type {
  DatabaseConnectionTester,
  ManagedDatabaseAdmin,
  ProjectRecord,
  ProjectRepository,
} from '@/db/control-plane/control-plane.ports';
import type { ProjectPoolInvalidator } from '@/db/tenant/database.ports';
import type { ConnectionTargetPolicy } from '@/projects/connection-target.policy';
import type { AppConfig } from '@/config/app-config.service';

function project(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 'project-1', name: 'Test', host: 'localhost', port: 5432, database: 'test', dbUser: 'test',
    isManaged: false, mcpEnabled: false, mcpAllowWrite: false, mcpAllowSchema: false,
    createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
  };
}

function build(parts: {
  repository?: Partial<ProjectRepository>;
  tester?: Partial<DatabaseConnectionTester>;
  admin?: Partial<ManagedDatabaseAdmin>;
  invalidator?: Partial<ProjectPoolInvalidator>;
  targets?: Partial<ConnectionTargetPolicy>;
  config?: Partial<AppConfig>;
} = {}) {
  return new ProjectsService(
    // Default the quota lookup so each test only mocks what it actually exercises.
    { countManaged: async () => 0, ...parts.repository } as ProjectRepository,
    parts.tester as DatabaseConnectionTester,
    parts.admin as ManagedDatabaseAdmin,
    parts.invalidator as ProjectPoolInvalidator,
    (parts.targets ?? { assertAllowed: async () => {} }) as ConnectionTargetPolicy,
    { postgres: { host: 'managed-db', port: 5432 }, maxManagedProjectsPerUser: 3, ...parts.config } as AppConfig,
  );
}

test('a connection is screened, then proven reachable, then saved', async () => {
  const calls: string[] = [];
  const service = build({
    repository: { createProject: async () => { calls.push('save'); return project(); } },
    tester: { assertConnectable: async () => { calls.push('test'); } },
    targets: { assertAllowed: async () => { calls.push('screen'); } },
  });

  const input = { name: 'Test', host: 'db.example.com', port: 5432, database: 'test', dbUser: 'test', dbPassword: 'secret' };
  // A connected project reports back the address it was given, so the caller can show
  // it without having to reassemble it from separate fields.
  assert.deepEqual(await service.create('user-1', input), {
    ...project(),
    connection: { host: 'localhost', port: 5432, database: 'test', user: 'test' },
  });
  assert.deepEqual(calls, ['screen', 'test', 'save'], 'a refused host must never be dialled');
});

// The host screen is what stops a user pointing the server at its own control plane.
test('a refused host is never connected to and never saved', async () => {
  const calls: string[] = [];
  const service = build({
    repository: { createProject: async () => { calls.push('save'); return project(); } },
    tester: { assertConnectable: async () => { calls.push('test'); } },
    targets: { assertAllowed: async () => { throw ApplicationError.badRequest('Refusing to connect to a loopback address.'); } },
  });

  const input = { name: 'Test', host: '127.0.0.1', port: 5432, database: 'test', dbUser: 'test', dbPassword: 'secret' };
  await assert.rejects(() => service.create('user-1', input), /Refusing to connect/);
  assert.deepEqual(calls, [], 'neither the connection test nor the insert should run');
});

// Provisioning targets the configured server on purpose and must not be screened.
test('managed provisioning bypasses the host screen', async () => {
  const calls: string[] = [];
  const service = build({
    repository: { createProject: async () => { calls.push('save'); return project(); } },
    tester: { assertConnectable: async () => { calls.push('test'); } },
    targets: { assertAllowed: async () => { throw ApplicationError.badRequest('should not run'); } },
  });

  const input = { name: 'My Database', host: 'db', port: 5432, database: 'tenant_db_1', dbUser: 'tenant_1', dbPassword: 'x' };
  await service.create('user-1', input, true);
  assert.deepEqual(calls, ['test', 'save']);
});

test('creating a managed project provisions credentials and saves an owned project', async () => {
  const calls: string[] = [];
  const service = build({
    repository: {
      createProject: async (userId, input, isManaged) => {
        calls.push(`save:${userId}:${input.host}:${isManaged}`);
        return project({ name: input.name, isManaged });
      },
    },
    admin: {
      createRole: async () => { calls.push('create-role'); },
      createDatabase: async () => { calls.push('create-database'); },
      dropDatabase: async () => {},
      dropRole: async () => {},
    },
    tester: { assertConnectable: async () => { calls.push('test'); } },
    targets: { assertAllowed: async () => { calls.push('screen'); } },
  });

  const result = await service.createManaged('user-1', 'Acme production');
  assert.equal(result.project.name, 'Acme production');
  assert.equal(result.project.isManaged, true);
  // Returned once here or the user has no way to reach a usable password.
  assert.ok(result.password.length > 20);
  assert.deepEqual(calls, ['create-role', 'create-database', 'test', 'save:user-1:managed-db:true']);
});

test('deleting an externally managed project never drops the user\'s database', async () => {
  const calls: string[] = [];
  const service = build({
    repository: {
      findOwnedResource: async () => ({ database: 'external', dbUser: 'owner', isManaged: false }),
      deleteOwned: async () => { calls.push('delete-metadata'); return true; },
    },
    admin: {
      dropDatabase: async () => { calls.push('drop-database'); },
      dropRole: async () => { calls.push('drop-role'); },
    },
    invalidator: { invalidateProject: async () => { calls.push('invalidate-pool'); } },
  });

  await service.remove('project-1', 'user-1');
  assert.deepEqual(calls, ['delete-metadata', 'invalidate-pool']);
});

test('deleting a managed project drops the database and role it created', async () => {
  const calls: string[] = [];
  const service = build({
    repository: {
      findOwnedResource: async () => ({ database: 'tenant_db_1', dbUser: 'tenant_1', isManaged: true }),
      deleteOwned: async () => true,
    },
    admin: {
      dropDatabase: async (name: string) => { calls.push(`drop-db:${name}`); },
      dropRole: async (name: string) => { calls.push(`drop-role:${name}`); },
    },
    invalidator: { invalidateProject: async () => {} },
  });

  await service.remove('project-1', 'user-1');
  assert.deepEqual(calls, ['drop-db:tenant_db_1', 'drop-role:tenant_1']);
});

test('a project belonging to someone else reads as not found', async () => {
  const service = build({ repository: { findOwned: async () => null } });
  await assert.rejects(
    () => service.get('project-1', 'other-user'),
    (error: unknown) => error instanceof ApplicationError && error.code === 'not_found',
  );
});

test('rotating a managed password invalidates the pool holding the old one', async () => {
  const calls: string[] = [];
  const service = build({
    repository: {
      findOwnedResource: async () => ({ database: 'tenant_db_1', dbUser: 'tenant_1', isManaged: true }),
      updatePassword: async () => { calls.push('store'); },
    },
    admin: { changeRolePassword: async () => { calls.push('alter-role'); } },
    invalidator: { invalidateProject: async () => { calls.push('invalidate-pool'); } },
  });

  const password = await service.regeneratePassword('project-1', 'user-1');
  assert.ok(password.length > 20, 'a rotated password must be long and random');
  assert.deepEqual(calls, ['alter-role', 'store', 'invalidate-pool']);
});

test('an unmanaged project cannot have its password rotated', async () => {
  const service = build({
    repository: { findOwnedResource: async () => ({ database: 'external', dbUser: 'owner', isManaged: false }) },
  });
  await assert.rejects(() => service.regeneratePassword('project-1', 'user-1'), /Only managed projects/);
});

test('an MCP token is verified against its stored hash, and a wrong one is refused', async () => {
  let storedHash: string | null = null;
  const service = build({
    repository: {
      setMcpTokenHash: async (_projectId: string, _userId: string, hash: string | null) => { storedHash = hash; return true; },
      findMcpCredential: async () => ({ ownerId: 'user-1', tokenHash: storedHash, allowWrite: true, allowSchema: false }),
    },
  });

  const token = await service.regenerateMcpToken('project-1', 'user-1');
  assert.ok(token.startsWith('mcp_'));
  assert.notEqual(storedHash, token, 'the raw token must never be stored');

  assert.deepEqual(await service.verifyMcpToken('project-1', token), {
    ownerId: 'user-1', allowWrite: true, allowSchema: false,
  });
  assert.equal(await service.verifyMcpToken('project-1', 'mcp_wrong'), null);
});

test('a revoked MCP token stops authenticating', async () => {
  const service = build({
    repository: { findMcpCredential: async () => ({ ownerId: 'user-1', tokenHash: null, allowWrite: false, allowSchema: false }) },
  });
  assert.equal(await service.verifyMcpToken('project-1', 'mcp_anything'), null);
});

// Port is the field users most often leave alone; requiring it made them type the
// PostgreSQL default by hand, and an empty box failed validation.
test('a project created without a port defaults to 5432', async () => {
  let saved: { port?: number } | undefined;
  const service = build({
    repository: { createProject: async (_userId, input) => { saved = input; return project(); } },
    tester: { assertConnectable: async () => {} },
  });

  const dto = new CreateProjectDto();
  Object.assign(dto, { name: 'Test', host: 'db.example.com', database: 'app', dbUser: 'app', dbPassword: 'x' });
  await service.create('user-1', dto);
  assert.equal(saved?.port, DEFAULT_POSTGRES_PORT);
  assert.equal(DEFAULT_POSTGRES_PORT, 5432);
});

test('an explicit port still overrides the default', async () => {
  let saved: { port?: number } | undefined;
  const service = build({
    repository: { createProject: async (_userId, input) => { saved = input; return project(); } },
    tester: { assertConnectable: async () => {} },
  });

  const dto = new CreateProjectDto();
  Object.assign(dto, { name: 'Test', host: 'db.example.com', port: 55432, database: 'app', dbUser: 'app', dbPassword: 'x' });
  await service.create('user-1', dto);
  assert.equal(saved?.port, 55432);
});

// Each managed project is a real CREATE DATABASE, so without a cap an open signup form
// is an unbounded way to fill the disk.
test('a user may not exceed the managed database quota', async () => {
  const created: string[] = [];
  const service = build({
    repository: { countManaged: async () => 3 },
    admin: { createRole: async (role: string) => { created.push(role); } },
    config: { maxManagedProjectsPerUser: 3 },
  });

  await assert.rejects(
    () => service.createManaged('user-1', 'Another'),
    (error: unknown) =>
      error instanceof ApplicationError
      && error.code === 'bad_request'
      && /already have 3 of 3/.test(error.message),
  );
  assert.deepEqual(created, [], 'the quota must be checked before any resource is created');
});

test('a user under the quota can still provision', async () => {
  const created: string[] = [];
  const service = build({
    repository: {
      countManaged: async () => 1,
      createProject: async () => project({ isManaged: true }),
    },
    tester: { assertConnectable: async () => {} },
    admin: {
      createRole: async (role: string) => { created.push(role); },
      createDatabase: async () => {},
    },
    config: { maxManagedProjectsPerUser: 3 },
  });

  const result = await service.createManaged('user-1', 'Second');
  assert.equal(result.project.isManaged, true);
  assert.ok(result.password.length > 20, 'the password must be returned once, or it is unreachable');
  assert.equal(created.length, 1);
});

// A managed project stores the host this process uses internally — a Docker service
// name — which is useless to anyone running psql or pgAdmin.
test('a managed project reports the configured public address, not the internal one', async () => {
  const service = build({
    repository: { findOwned: async () => project({ isManaged: true, host: 'db', port: 5432 }) },
    config: { tenantPublicHost: 'studio.example.com', tenantPublicPort: 5432 },
  });

  const result = await service.get('project-1', 'user-1');
  assert.equal(result.host, 'db', 'the stored host is what the backend still uses');
  assert.deepEqual(result.connection, {
    host: 'studio.example.com',
    port: 5432,
    database: 'test',
    user: 'test',
  });
});

// Offering an address that cannot work is worse than saying there is none.
test('a managed project reports no address when postgres is not published', async () => {
  const service = build({
    repository: { findOwned: async () => project({ isManaged: true, host: 'db' }) },
    config: { tenantPublicHost: '' },
  });

  assert.equal((await service.get('project-1', 'user-1')).connection, null);
});

test('a connected project reports the address the user gave, unchanged', async () => {
  const service = build({
    repository: { findOwned: async () => project({ isManaged: false, host: 'their-db.example.com', port: 6543 }) },
    config: { tenantPublicHost: 'studio.example.com' },
  });

  const result = await service.get('project-1', 'user-1');
  assert.deepEqual(result.connection, {
    host: 'their-db.example.com',
    port: 6543,
    database: 'test',
    user: 'test',
  });
});

test('every project in a listing carries its connection target', async () => {
  const service = build({
    repository: { listOwned: async () => [project({ isManaged: true }), project({ id: 'p2', isManaged: false })] },
    config: { tenantPublicHost: 'studio.example.com', tenantPublicPort: 5432 },
  });

  const listed = await service.list('user-1');
  assert.equal(listed.length, 2);
  assert.equal(listed[0]?.connection?.host, 'studio.example.com');
  assert.equal(listed[1]?.connection?.host, 'localhost', 'unmanaged keeps its own host');
});
