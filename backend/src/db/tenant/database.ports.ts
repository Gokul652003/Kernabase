import { QueryResult, QueryResultRow } from 'pg';

export interface ProjectConnectionInfo {
  id: string;
  host: string;
  port: number;
  database: string;
  dbUser: string;
  dbPassword: string;
}

export const PROJECT_CONNECTION_READER = Symbol('PROJECT_CONNECTION_READER');
export const PROJECT_DATABASE = Symbol('PROJECT_DATABASE');

export interface ProjectConnectionReader {
  getConnectionInfo(projectId: string, userId: string | undefined): Promise<ProjectConnectionInfo>;
}

export interface ProjectDatabase {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  quoteIdent(name: string): string;
  /**
   * Runs `work` inside a single transaction on one connection, rolling back on throw.
   * PostgreSQL DDL is transactional, so a multi-statement schema change either lands
   * completely or not at all.
   */
  transaction<T>(work: (tx: Pick<ProjectDatabase, 'query' | 'quoteIdent'>) => Promise<T>): Promise<T>;
}

export const PROJECT_POOL_INVALIDATOR = Symbol('PROJECT_POOL_INVALIDATOR');

export interface ProjectPoolInvalidator {
  invalidateProject(projectId: string): Promise<void>;
}

export const POOL_METRICS_READER = Symbol('POOL_METRICS_READER');

export interface PoolMetrics {
  cachedTenantPools: number;
  maxTenantPools: number;
  configuredConnectionBudget: number;
  openTenantConnections: number;
  idleTenantConnections: number;
  waitingTenantRequests: number;
  evictions: { idle: number; capacity: number; credentials: number; invalidated: number };
}

/** Read-only view of connection state, for health and metrics endpoints. */
export interface PoolMetricsReader {
  getMetrics(): PoolMetrics;
  /** True when the control-plane database answers a trivial query. */
  isControlPlaneReachable(): Promise<boolean>;
}
