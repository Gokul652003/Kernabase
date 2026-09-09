import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { ApplicationError } from '@/common/errors/application.error';
import { ConnectionRegistry } from '@/db/tenant/connection-registry.service';
import { PROJECT_CONNECTION_READER, ProjectConnectionReader, ProjectDatabase } from '@/db/tenant/database.ports';
import { getTenantContext } from '@/db/tenant/tenant-context';
import { quoteIdentifier } from '@/db/sql.util';

/**
 * Routes queries to the tenant database of the project in the current request.
 *
 * A singleton: the per-request state (which project, which user, the resolved pool)
 * lives in AsyncLocalStorage rather than in the provider, so nothing downstream of
 * this service has to become request-scoped.
 */
@Injectable()
export class TenantDatabaseService implements ProjectDatabase {
  constructor(
    private readonly registry: ConnectionRegistry,
    @Inject(PROJECT_CONNECTION_READER) private readonly projects: ProjectConnectionReader,
  ) {}

  private resolvePool(): Promise<Pool> {
    const context = getTenantContext();
    if (!context) {
      throw new Error('Tenant database used outside a request scope');
    }
    if (!context.poolPromise) {
      context.poolPromise = this.openPool();
    }
    return context.poolPromise;
  }

  private async openPool(): Promise<Pool> {
    const context = getTenantContext();
    const projectId = context?.request.params?.['projectId'];
    if (!projectId) {
      throw ApplicationError.badRequest('This endpoint must be called under a project route');
    }
    const info = await this.projects.getConnectionInfo(projectId, context?.request.user?.userId);
    return this.registry.getProjectPool(info);
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    const pool = await this.resolvePool();
    return pool.query<T>(text, params as unknown[]);
  }

  quoteIdent(name: string): string {
    return quoteIdentifier(name);
  }

  async transaction<T>(work: (tx: Pick<ProjectDatabase, 'query' | 'quoteIdent'>) => Promise<T>): Promise<T> {
    const pool = await this.resolvePool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work({
        query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) =>
          client.query<R>(text, params as unknown[]),
        quoteIdent: (name: string) => quoteIdentifier(name),
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}
