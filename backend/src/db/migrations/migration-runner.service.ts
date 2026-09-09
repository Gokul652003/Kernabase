import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConnectionRegistry } from '@/db/tenant/connection-registry.service';
import { initialMigration } from '@/db/migrations/001-initial';
import { controlPlaneIndexesMigration } from '@/db/migrations/002-control-plane-indexes';
import { revokePublicTenantConnectMigration } from '@/db/migrations/003-revoke-public-tenant-connect';

const MIGRATIONS = [
  { version: 1, name: 'initial', sql: initialMigration },
  { version: 2, name: 'control-plane-indexes', sql: controlPlaneIndexesMigration },
  { version: 3, name: 'revoke-public-tenant-connect', sql: revokePublicTenantConnectMigration },
];

@Injectable()
export class MigrationRunner implements OnModuleInit {
  private readonly logger = new Logger(MigrationRunner.name);
  constructor(private readonly registry: ConnectionRegistry) {}

  async onModuleInit(): Promise<void> {
    const pool = this.registry.getControlPlanePool();
    await pool.query(`CREATE SCHEMA IF NOT EXISTS _studio;
      CREATE TABLE IF NOT EXISTS _studio.migrations (
        version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    for (const migration of MIGRATIONS) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('mydb-studio-migrations'))");
        const result = await client.query('SELECT 1 FROM _studio.migrations WHERE version = $1', [migration.version]);
        if (result.rowCount === 0) {
          await client.query(migration.sql);
          await client.query('INSERT INTO _studio.migrations(version, name) VALUES ($1, $2)', [migration.version, migration.name]);
          this.logger.log(`Applied migration ${migration.version}: ${migration.name}`);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }
}
