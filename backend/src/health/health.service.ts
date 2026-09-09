import { Inject, Injectable } from '@nestjs/common';
import { POOL_METRICS_READER, PoolMetricsReader } from '@/db/tenant/database.ports';
import { HealthApplication, HealthMetrics } from '@/health/health-service.port';

@Injectable()
export class HealthService implements HealthApplication {
  constructor(@Inject(POOL_METRICS_READER) private readonly pools: PoolMetricsReader) {}

  snapshot(): { ok: true; connections: HealthMetrics } {
    return { ok: true, connections: this.pools.getMetrics() };
  }

  async readiness(): Promise<{ ok: boolean; connections: HealthMetrics }> {
    return { ok: await this.pools.isControlPlaneReachable(), connections: this.pools.getMetrics() };
  }

  prometheusMetrics(): string {
    const metrics = this.pools.getMetrics();
    const memory = process.memoryUsage();
    return [
      '# HELP kernabase_cached_tenant_pools Number of cached tenant pools.',
      '# TYPE kernabase_cached_tenant_pools gauge',
      `kernabase_cached_tenant_pools ${metrics.cachedTenantPools}`,
      '# HELP kernabase_tenant_connections Open tenant database connections.',
      '# TYPE kernabase_tenant_connections gauge',
      `kernabase_tenant_connections ${metrics.openTenantConnections}`,
      '# HELP kernabase_tenant_waiting_requests Requests waiting for a tenant connection.',
      '# TYPE kernabase_tenant_waiting_requests gauge',
      `kernabase_tenant_waiting_requests ${metrics.waitingTenantRequests}`,
      '# HELP process_resident_memory_bytes Resident memory used by this process.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${memory.rss}`,
      '',
    ].join('\n');
  }
}
