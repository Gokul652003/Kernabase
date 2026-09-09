import { AsyncLocalStorage } from 'async_hooks';
import { Pool } from 'pg';
import { AuthedRequest } from '@/common/http/authed-request';

export interface TenantContextStore {
  /**
   * The in-flight request. Read lazily rather than snapshotted: Express fills in
   * `params` during routing and the guards fill in `user`, both after the middleware
   * that opens this scope has already run.
   */
  request: AuthedRequest;
  /** Memoizes pool resolution so repeated queries in one request resolve it once. */
  poolPromise?: Promise<Pool>;
}

const storage = new AsyncLocalStorage<TenantContextStore>();

/**
 * Opens a tenant scope for the duration of one request.
 *
 * This replaces what used to be `Scope.REQUEST` on the tenant database service. Request
 * scoping in Nest is contagious: every provider and controller that transitively depends
 * on a request-scoped provider is re-instantiated per request, which previously covered
 * the tables, sql, schemas, policies and MCP layers. AsyncLocalStorage carries the same
 * per-request state with singleton providers.
 */
export function runInTenantContext<T>(request: AuthedRequest, fn: () => T): T {
  return storage.run({ request }, fn);
}

export function getTenantContext(): TenantContextStore | undefined {
  return storage.getStore();
}
