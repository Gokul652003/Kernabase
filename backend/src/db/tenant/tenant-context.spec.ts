import test from 'node:test';
import assert from 'node:assert/strict';
import type { AuthedRequest } from '@/common/http/authed-request';
import { getTenantContext, runInTenantContext } from '@/db/tenant/tenant-context';

function request(projectId: string, userId: string): AuthedRequest {
  return { params: { projectId }, user: { userId, email: `${userId}@example.com` } } as unknown as AuthedRequest;
}

test('there is no tenant context outside a request', () => {
  assert.equal(getTenantContext(), undefined);
});

test('the context exposes the request that opened it', () => {
  runInTenantContext(request('project-1', 'user-1'), () => {
    assert.equal(getTenantContext()?.request.params['projectId'], 'project-1');
    assert.equal(getTenantContext()?.request.user?.userId, 'user-1');
  });
});

// This is the property that made it safe to drop Scope.REQUEST: two requests interleaving
// on the event loop must never observe each other's project.
test('concurrent requests never see each other\'s tenant', async () => {
  const observed: string[] = [];

  async function handle(projectId: string, delayMs: number): Promise<string | undefined> {
    return runInTenantContext(request(projectId, projectId), async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const seen = getTenantContext()?.request.params['projectId'];
      observed.push(`${projectId}:${seen}`);
      return seen;
    });
  }

  const [first, second, third] = await Promise.all([handle('a', 20), handle('b', 5), handle('c', 10)]);
  assert.equal(first, 'a');
  assert.equal(second, 'b');
  assert.equal(third, 'c');
  assert.deepEqual(observed.sort(), ['a:a', 'b:b', 'c:c']);
});

test('the pool promise is memoized per request, not per process', async () => {
  const outer = await runInTenantContext(request('project-1', 'user-1'), async () => {
    const context = getTenantContext();
    assert.ok(context);
    context.poolPromise = Promise.resolve('pool-1' as never);
    await Promise.resolve();
    return getTenantContext()?.poolPromise;
  });
  assert.equal(await outer, 'pool-1');

  await runInTenantContext(request('project-2', 'user-2'), async () => {
    assert.equal(getTenantContext()?.poolPromise, undefined, 'a new request starts with no pool');
  });
});
