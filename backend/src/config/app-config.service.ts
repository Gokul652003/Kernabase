import { Injectable } from '@nestjs/common';

export interface PostgresConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
}

export interface HttpConfig {
  corsOrigins: string[];
  bodyLimit: string;
  globalRateLimit: number;
  authRateLimit: number;
  rateWindowMs: number;
}

export interface TenantPoolConfig {
  maxPools: number;
  maxConnectionsPerPool: number;
  connectionBudget: number;
  poolIdleTtlMs: number;
  sweepIntervalMs: number;
  connectionTimeoutMs: number;
  connectionIdleTimeoutMs: number;
}

@Injectable()
export class AppConfig {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly port = this.integer('PORT', 3001);
  readonly postgres: PostgresConfig = {
    host: process.env.PGHOST ?? 'localhost',
    port: this.integer('PGPORT', 55432),
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD ?? 'postgres',
    database: process.env.PGDATABASE ?? 'mydb',
    max: this.integer('CONTROL_POOL_MAX_CONNECTIONS', 10),
    connectionTimeoutMillis: this.integer('DB_CONNECTION_TIMEOUT_MS', 5000),
    idleTimeoutMillis: this.integer('DB_CONNECTION_IDLE_TIMEOUT_MS', 30000),
  };
  readonly tenantPools: TenantPoolConfig = {
    maxPools: this.integer('TENANT_POOL_MAX_POOLS', 100),
    maxConnectionsPerPool: this.integer('TENANT_POOL_MAX_CONNECTIONS', 3),
    connectionBudget: this.integer('TENANT_POOL_CONNECTION_BUDGET', 300),
    poolIdleTtlMs: this.integer('TENANT_POOL_IDLE_TTL_MS', 300000),
    sweepIntervalMs: this.integer('TENANT_POOL_SWEEP_INTERVAL_MS', 60000),
    connectionTimeoutMs: this.integer('DB_CONNECTION_TIMEOUT_MS', 5000),
    connectionIdleTimeoutMs: this.integer('DB_CONNECTION_IDLE_TIMEOUT_MS', 30000),
  };
  readonly jwtSecret = this.secret('STUDIO_JWT_SECRET', 'mydb-studio-dev-jwt-secret-change-me');
  readonly encryptionSecret = this.secret('STUDIO_SECRET', 'mydb-studio-dev-secret-change-me');
  readonly jwtExpiresIn = process.env.STUDIO_JWT_EXPIRES_IN ?? '30d';
  readonly http: HttpConfig = {
    corsOrigins: this.csv('CORS_ORIGINS', ['http://localhost:5173']),
    bodyLimit: process.env.HTTP_BODY_LIMIT ?? '1mb',
    globalRateLimit: this.integer('RATE_LIMIT_MAX', 300),
    authRateLimit: this.integer('AUTH_RATE_LIMIT_MAX', 20),
    rateWindowMs: this.integer('RATE_LIMIT_WINDOW_MS', 60000),
  };
  readonly tenantStatementTimeoutMs = this.integer('TENANT_STATEMENT_TIMEOUT_MS', 15000);
  /**
   * How many databases one account may have the studio provision for it.
   *
   * Each managed project is a real CREATE DATABASE on this server, so without a cap an
   * open signup form is an unbounded way to consume disk. Connected (unmanaged)
   * projects are only stored credentials and are not counted.
   */
  readonly maxManagedProjectsPerUser = this.integer('MAX_MANAGED_PROJECTS_PER_USER', 3);
  readonly sqlMaxRows = this.integer('SQL_MAX_ROWS', 10000);
  readonly sqlMaxResponseBytes = this.integer('SQL_MAX_RESPONSE_BYTES', 5_000_000);
  /**
   * Whether users may register databases on private/internal networks. Off by default:
   * on a shared deployment it is what stops one user reaching the control plane or
   * port-scanning the internal network. Self-hosted single-user installs that connect
   * to a LAN database can turn it on.
   */
  readonly allowPrivateDatabaseHosts = this.flag('ALLOW_PRIVATE_DATABASE_HOSTS', false);
  /**
   * How many reverse proxies sit in front of this process.
   *
   * Express reports the socket address as `req.ip`, which behind a proxy is the proxy
   * itself — so every visitor shares one rate-limit bucket and the per-IP auth limit
   * becomes a global one. Setting this to the number of trusted hops makes Express read
   * the client address from X-Forwarded-For instead. Leave it at 0 when the process is
   * exposed directly: trusting the header without a proxy lets a client forge its own IP.
   */
  readonly trustedProxyHops = this.integer('TRUSTED_PROXY_HOPS', 0, { allowZero: true });

  private integer(name: string, fallback: number, options?: { allowZero?: boolean }): number {
    const value = process.env[name];
    if (value === undefined) return fallback;
    const parsed = Number(value);
    const floor = options?.allowZero ? 0 : 1;
    if (!Number.isInteger(parsed) || parsed < floor) {
      throw new Error(`${name} must be an integer of at least ${floor}`);
    }
    return parsed;
  }

  private secret(name: string, developmentFallback: string): string {
    const value = process.env[name];
    if (value) return value;
    if (this.nodeEnv === 'production') throw new Error(`${name} is required in production`);
    return developmentFallback;
  }

  private flag(name: string, fallback: boolean): boolean {
    const value = process.env[name];
    if (value === undefined) return fallback;
    if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
    if (['false', '0', 'no'].includes(value.toLowerCase())) return false;
    throw new Error(`${name} must be a boolean`);
  }

  private csv(name: string, fallback: string[]): string[] {
    const value = process.env[name];
    return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : fallback;
  }
}
