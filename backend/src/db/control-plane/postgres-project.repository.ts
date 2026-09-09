import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfig } from '@/config/app-config.service';
import { CONTROL_PLANE_POOL } from '@/db/control-plane/control-plane.pool';
import { decryptSecret, encryptSecret } from '@/db/control-plane/crypto.util';
import {
  ManagedProjectResource,
  McpCredentialRecord,
  NewProjectRecord,
  ProjectRecord,
  ProjectRepository,
} from '@/db/control-plane/control-plane.ports';
import { ProjectConnectionInfo } from '@/db/tenant/database.ports';

/** Columns safe to return to callers — deliberately never includes `db_password`. */
const SUMMARY_COLUMNS = `id, name, host, port, database, db_user AS "dbUser", is_managed AS "isManaged", (mcp_token_hash IS NOT NULL) AS "mcpEnabled", mcp_allow_write AS "mcpAllowWrite", mcp_allow_schema AS "mcpAllowSchema", created_at AS "createdAt"`;

@Injectable()
export class PostgresProjectRepository implements ProjectRepository {
  constructor(
    @Inject(CONTROL_PLANE_POOL) private readonly pool: Pool,
    private readonly config: AppConfig,
  ) {}

  async listOwned(userId: string): Promise<ProjectRecord[]> {
    const { rows } = await this.pool.query<ProjectRecord>(
      `SELECT ${SUMMARY_COLUMNS} FROM _studio.projects WHERE owner_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows;
  }

  async createProject(userId: string, project: NewProjectRecord, isManaged: boolean): Promise<ProjectRecord> {
    const { rows } = await this.pool.query<ProjectRecord>(
      `INSERT INTO _studio.projects (owner_id, name, host, port, database, db_user, db_password, is_managed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${SUMMARY_COLUMNS}`,
      [userId, project.name, project.host, project.port, project.database, project.dbUser,
        encryptSecret(project.dbPassword, this.config.encryptionSecret), isManaged],
    );
    const row = rows[0];
    if (!row) throw new Error('INSERT ... RETURNING produced no row');
    return row;
  }

  async findOwned(projectId: string, userId: string): Promise<ProjectRecord | null> {
    const { rows } = await this.pool.query<ProjectRecord>(
      `SELECT ${SUMMARY_COLUMNS} FROM _studio.projects WHERE id = $1 AND owner_id = $2`,
      [projectId, userId],
    );
    return rows[0] ?? null;
  }

  async rename(projectId: string, userId: string, name: string): Promise<ProjectRecord | null> {
    const { rows } = await this.pool.query<ProjectRecord>(
      `UPDATE _studio.projects SET name = $1 WHERE id = $2 AND owner_id = $3 RETURNING ${SUMMARY_COLUMNS}`,
      [name, projectId, userId],
    );
    return rows[0] ?? null;
  }

  async findOwnedResource(projectId: string, userId: string): Promise<ManagedProjectResource | null> {
    const { rows } = await this.pool.query<{ database: string; db_user: string; is_managed: boolean }>(
      'SELECT database, db_user, is_managed FROM _studio.projects WHERE id = $1 AND owner_id = $2',
      [projectId, userId],
    );
    const row = rows[0];
    return row ? { database: row.database, dbUser: row.db_user, isManaged: row.is_managed } : null;
  }

  async deleteOwned(projectId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM _studio.projects WHERE id = $1 AND owner_id = $2', [projectId, userId]);
    return result.rowCount !== 0;
  }

  async updatePassword(projectId: string, password: string): Promise<void> {
    await this.pool.query('UPDATE _studio.projects SET db_password = $1 WHERE id = $2', [
      encryptSecret(password, this.config.encryptionSecret), projectId,
    ]);
  }

  async connectionInfo(projectId: string, userId: string): Promise<ProjectConnectionInfo | null> {
    const { rows } = await this.pool.query<{
      id: string; host: string; port: number; database: string; db_user: string; db_password: string;
    }>(
      'SELECT id, host, port, database, db_user, db_password FROM _studio.projects WHERE id = $1 AND owner_id = $2',
      [projectId, userId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      host: row.host,
      port: row.port,
      database: row.database,
      dbUser: row.db_user,
      dbPassword: decryptSecret(row.db_password, this.config.encryptionSecret),
    };
  }

  async setMcpTokenHash(projectId: string, userId: string, tokenHash: string | null): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE _studio.projects SET mcp_token_hash = $1 WHERE id = $2 AND owner_id = $3',
      [tokenHash, projectId, userId],
    );
    return result.rowCount !== 0;
  }

  async setMcpPermissions(
    projectId: string,
    userId: string,
    allowWrite: boolean,
    allowSchema: boolean,
  ): Promise<ProjectRecord | null> {
    const { rows } = await this.pool.query<ProjectRecord>(
      `UPDATE _studio.projects SET mcp_allow_write = $1, mcp_allow_schema = $2
       WHERE id = $3 AND owner_id = $4 RETURNING ${SUMMARY_COLUMNS}`,
      [allowWrite, allowSchema, projectId, userId],
    );
    return rows[0] ?? null;
  }

  async findMcpCredential(projectId: string): Promise<McpCredentialRecord | null> {
    const { rows } = await this.pool.query<{
      owner_id: string; mcp_token_hash: string | null; mcp_allow_write: boolean; mcp_allow_schema: boolean;
    }>(
      'SELECT owner_id, mcp_token_hash, mcp_allow_write, mcp_allow_schema FROM _studio.projects WHERE id = $1',
      [projectId],
    );
    const row = rows[0];
    return row
      ? { ownerId: row.owner_id, tokenHash: row.mcp_token_hash, allowWrite: row.mcp_allow_write, allowSchema: row.mcp_allow_schema }
      : null;
  }
}
