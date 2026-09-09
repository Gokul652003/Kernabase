import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfig } from '@/config/app-config.service';
import { createHash } from 'crypto';
import { ApplicationError } from '@/common/errors/application.error';
import { PoolMetrics, PoolMetricsReader, ProjectConnectionInfo, ProjectPoolInvalidator } from '@/db/tenant/database.ports';

export type { ProjectConnectionInfo } from '@/db/tenant/database.ports';

interface PoolEntry {
  pool: Pool;
  fingerprint: string;
  lastUsedAt: number;
}

@Injectable()
export class ConnectionRegistry implements OnModuleDestroy, PoolMetricsReader, ProjectPoolInvalidator {
  private readonly logger = new Logger(ConnectionRegistry.name);
  private readonly controlPlanePool: Pool;
  private readonly projectPools = new Map<string, PoolEntry>();
  private readonly maxProjectPools: number;
  private readonly maxConnectionsPerPool: number;
  private readonly evictions = { idle: 0, capacity: 0, credentials: 0, invalidated: 0 };
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(private readonly config: AppConfig) {
    this.controlPlanePool = new Pool(config.postgres);
    this.maxConnectionsPerPool = Math.min(config.tenantPools.maxConnectionsPerPool, config.tenantPools.connectionBudget);
    this.maxProjectPools = Math.min(
      config.tenantPools.maxPools,
      Math.max(1, Math.floor(config.tenantPools.connectionBudget / this.maxConnectionsPerPool)),
    );
    // pg's Pool emits 'error' for problems on idle pooled connections (auth failure,
    // network blip, connection reaped, ...). With no listener, Node treats that as an
    // unhandled exception and kills the whole process — this is what keeps it alive.
    this.controlPlanePool.on('error', (err) => this.logger.error(`Control-plane pool error: ${err.message}`));
    this.sweepTimer = setInterval(() => this.evictIdlePools(), config.tenantPools.sweepIntervalMs);
    this.sweepTimer.unref();
  }

  getControlPlanePool(): Pool {
    return this.controlPlanePool;
  }

  getProjectPool(info: ProjectConnectionInfo): Pool {
    const now = Date.now();
    const fingerprint = this.fingerprint(info);
    let entry = this.projectPools.get(info.id);
    if (entry && entry.fingerprint !== fingerprint) {
      this.remove(info.id, entry, 'credentials');
      entry = undefined;
    }
    if (!entry) {
      this.ensureCapacity();
      const pool = new Pool({
        host: info.host,
        port: info.port,
        user: info.dbUser,
        password: info.dbPassword,
        database: info.database,
        max: this.maxConnectionsPerPool,
        connectionTimeoutMillis: this.config.tenantPools.connectionTimeoutMs,
        idleTimeoutMillis: this.config.tenantPools.connectionIdleTimeoutMs,
        options: `-c statement_timeout=${this.config.tenantStatementTimeoutMs} -c idle_in_transaction_session_timeout=${this.config.tenantStatementTimeoutMs}`,
        application_name: 'kernabase-tenant',
      });
      pool.on('error', (err) => this.logger.error(`Project pool error (${info.id}): ${err.message}`));
      entry = { pool, fingerprint, lastUsedAt: now };
      this.projectPools.set(info.id, entry);
    }
    entry.lastUsedAt = now;
    return entry.pool;
  }

  async invalidateProject(projectId: string): Promise<void> {
    const entry = this.projectPools.get(projectId);
    if (entry) await this.remove(projectId, entry, 'invalidated');
  }

  async isControlPlaneReachable(): Promise<boolean> {
    try {
      await this.controlPlanePool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  getMetrics(): PoolMetrics {
    const entries = [...this.projectPools.values()];
    return {
      cachedTenantPools: entries.length,
      maxTenantPools: this.maxProjectPools,
      configuredConnectionBudget: this.config.tenantPools.connectionBudget,
      openTenantConnections: entries.reduce((sum, entry) => sum + entry.pool.totalCount, 0),
      idleTenantConnections: entries.reduce((sum, entry) => sum + entry.pool.idleCount, 0),
      waitingTenantRequests: entries.reduce((sum, entry) => sum + entry.pool.waitingCount, 0),
      evictions: { ...this.evictions },
    };
  }

  private fingerprint(info: ProjectConnectionInfo): string {
    return createHash('sha256')
      .update(`${info.host}\0${info.port}\0${info.database}\0${info.dbUser}\0${info.dbPassword}`)
      .digest('hex');
  }

  private ensureCapacity(): void {
    if (this.projectPools.size < this.maxProjectPools) return;
    const evictable = [...this.projectPools.entries()].filter(
      ([, entry]) => entry.pool.totalCount === entry.pool.idleCount && entry.pool.waitingCount === 0,
    );
    if (evictable.length === 0) {
      throw new ApplicationError('service_unavailable', 'Tenant database connection capacity is temporarily exhausted');
    }
    const oldest = evictable.reduce((candidate, current) =>
      current[1].lastUsedAt < candidate[1].lastUsedAt ? current : candidate,
    );
    void this.remove(oldest[0], oldest[1], 'capacity');
  }

  private evictIdlePools(): void {
    const cutoff = Date.now() - this.config.tenantPools.poolIdleTtlMs;
    for (const [projectId, entry] of this.projectPools) {
      if (entry.lastUsedAt <= cutoff && entry.pool.totalCount === entry.pool.idleCount) {
        void this.remove(projectId, entry, 'idle');
      }
    }
  }

  private async remove(projectId: string, entry: PoolEntry, reason: keyof PoolMetrics['evictions']): Promise<void> {
    if (this.projectPools.get(projectId) !== entry) return;
    this.projectPools.delete(projectId);
    this.evictions[reason] += 1;
    await entry.pool.end().catch((err) => this.logger.warn(`Error closing pool for project ${projectId}: ${err}`));
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.sweepTimer);
    await this.controlPlanePool.end().catch(() => {});
    const entries = [...this.projectPools.values()];
    this.projectPools.clear();
    await Promise.all(entries.map(({ pool }) => pool.end().catch(() => {})));
  }
}
