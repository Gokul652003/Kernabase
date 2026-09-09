import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfig } from '@/config/app-config.service';
import { CONTROL_PLANE_POOL } from '@/db/control-plane/control-plane.pool';

/**
 * Checks at boot that PostgreSQL can actually serve the connections this process is
 * configured to open.
 *
 * The pool registry enforces its own budget, but nothing previously compared that
 * budget to the server's `max_connections`. Configured too high, the limits look
 * healthy until real load arrives and PostgreSQL starts refusing with
 * "sorry, too many clients already" — a raw driver error rather than the deliberate
 * `service_unavailable` the registry returns when it sheds load itself.
 *
 * This turns that into a startup failure with a message naming both numbers.
 */
@Injectable()
export class ConnectionBudgetGuard implements OnModuleInit {
  private readonly logger = new Logger(ConnectionBudgetGuard.name);

  constructor(
    @Inject(CONTROL_PLANE_POOL) private readonly pool: Pool,
    private readonly config: AppConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    const serverLimit = await this.readMaxConnections();
    if (serverLimit === null) return;

    // Reserve what PostgreSQL keeps back for superuser maintenance connections, or the
    // last few slots are unusable and the effective ceiling is lower than it looks.
    const reserved = await this.readIntegerSetting('superuser_reserved_connections') ?? 3;
    const required = this.config.tenantPools.connectionBudget + this.config.postgres.max;
    const usable = serverLimit - reserved;

    if (required > usable) {
      throw new Error(
        `Connection budget exceeds what PostgreSQL can serve: this process may open up to ${required} `
          + `connections (TENANT_POOL_CONNECTION_BUDGET=${this.config.tenantPools.connectionBudget} plus `
          + `CONTROL_POOL_MAX_CONNECTIONS=${this.config.postgres.max}), but the server allows ${usable} `
          + `(max_connections=${serverLimit} minus ${reserved} reserved). Lower the budget or raise max_connections.`,
      );
    }

    this.logger.log(`Connection budget ${required}/${usable} within the server limit`);
  }

  private async readMaxConnections(): Promise<number | null> {
    try {
      return await this.readIntegerSetting('max_connections');
    } catch (error) {
      // A misconfigured budget must not stop a server that is otherwise able to start;
      // readiness already reports an unreachable control plane.
      this.logger.warn(`Could not verify the connection budget: ${(error as Error).message}`);
      return null;
    }
  }

  private async readIntegerSetting(name: string): Promise<number | null> {
    const { rows } = await this.pool.query<{ setting: string }>(
      'SELECT setting FROM pg_settings WHERE name = $1',
      [name],
    );
    const raw = rows[0]?.setting;
    if (raw === undefined) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  }
}
