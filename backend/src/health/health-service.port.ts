import { PoolMetrics } from '@/db/tenant/database.ports';

export const HEALTH_APPLICATION = Symbol('HEALTH_APPLICATION');

export type HealthMetrics = PoolMetrics;

export interface HealthApplication {
  snapshot(): { ok: true; connections: HealthMetrics };
  readiness(): Promise<{ ok: boolean; connections: HealthMetrics }>;
  prometheusMetrics(): string;
}
