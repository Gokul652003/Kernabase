import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CONTROL_PLANE_POOL } from '@/db/control-plane/control-plane.pool';
import { ManagedDatabaseAdmin } from '@/db/control-plane/control-plane.ports';
import { quoteIdentifier, quoteLiteral } from '@/db/sql.util';

// CREATE ROLE / ALTER ROLE cannot parameterize a password, so it goes through
// quoteLiteral. Callers only ever pass generated base64url secrets, but the escape
// stays in place so a future caller cannot introduce an injection here by accident.

@Injectable()
export class PostgresDatabaseAdminAdapter implements ManagedDatabaseAdmin {
  constructor(@Inject(CONTROL_PLANE_POOL) private readonly pool: Pool) {}

  async createRole(role: string, password: string): Promise<void> {
    await this.pool.query(`CREATE ROLE ${quoteIdentifier(role)} WITH LOGIN PASSWORD ${quoteLiteral(password)}`);
  }

  async createDatabase(database: string, ownerRole: string): Promise<void> {
    const name = quoteIdentifier(database);
    await this.pool.query(`CREATE DATABASE ${name} OWNER ${quoteIdentifier(ownerRole)}`);
    // PostgreSQL grants CONNECT to PUBLIC on every new database, which would let any
    // other tenant role open this one and read its catalogs. The owner keeps access
    // through its own privileges.
    await this.pool.query(`REVOKE CONNECT ON DATABASE ${name} FROM PUBLIC`);
  }

  async changeRolePassword(role: string, password: string): Promise<void> {
    await this.pool.query(`ALTER ROLE ${quoteIdentifier(role)} WITH PASSWORD ${quoteLiteral(password)}`);
  }

  async dropDatabase(database: string): Promise<void> {
    await this.pool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)} WITH (FORCE)`);
  }

  async dropRole(role: string): Promise<void> {
    await this.pool.query(`DROP ROLE IF EXISTS ${quoteIdentifier(role)}`);
  }
}
