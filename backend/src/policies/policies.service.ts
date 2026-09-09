import { ApplicationError } from '@/common/errors/application.error';
import { Inject, Injectable } from '@nestjs/common';
import { PROJECT_DATABASE, ProjectDatabase } from '@/db/tenant/database.ports';
import { CreatePolicyDto } from '@/policies/dto/create-policy.dto';
import { PolicyInfo, RlsStatus } from '@/policies/policies.types';
import { PoliciesApplication } from '@/policies/policies-service.port';
import { TableMetadataService } from '@/tables/table-metadata.service';
import { normalizeSchema, qualifiedName } from '@/db/sql.util';

const POLICY_ROLE_KEYWORDS = new Set(['public', 'current_role', 'current_user', 'session_user']);

@Injectable()
export class PoliciesService implements PoliciesApplication {
  constructor(
    @Inject(PROJECT_DATABASE) private readonly db: ProjectDatabase,
    private readonly metadata: TableMetadataService,
  ) {}

  /** Every policy operation is scoped to a table that must already exist. */
  private async requireTable(table: string, schema: string): Promise<void> {
    if (!(await this.metadata.exists(table, schema))) throw ApplicationError.notFound('Table not found');
  }

  private formatRole(role: string): string {
    const trimmed = role.trim();
    if (POLICY_ROLE_KEYWORDS.has(trimmed.toLowerCase())) return trimmed.toLowerCase();
    return this.db.quoteIdent(trimmed);
  }

  async getRlsStatus(table: string, schema?: string): Promise<RlsStatus> {
    const schemaName = normalizeSchema(schema);
    await this.requireTable(table, schemaName);
    const { rows } = await this.db.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class
       JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
       WHERE pg_namespace.nspname = $1 AND pg_class.relname = $2`,
      [schemaName, table],
    );
    return { enabled: rows[0]?.relrowsecurity ?? false };
  }

  async setRlsEnabled(table: string, enabled: boolean, schema?: string): Promise<void> {
    const schemaName = normalizeSchema(schema);
    await this.requireTable(table, schemaName);
    try {
      await this.db.query(
        `ALTER TABLE ${qualifiedName(schemaName, table)} ${enabled ? 'ENABLE' : 'DISABLE'} ROW LEVEL SECURITY`,
      );
    } catch (err) {
      throw ApplicationError.fromDriver(err);
    }
  }

  async listPolicies(table: string, schema?: string): Promise<PolicyInfo[]> {
    const schemaName = normalizeSchema(schema);
    await this.requireTable(table, schemaName);
    // roles is a name[] — node-pg has no built-in array parser for that OID, so it
    // comes back as a raw "{a,b}" literal unless cast through jsonb first.
    const { rows } = await this.db.query<PolicyInfo>(
      `SELECT policyname AS name, permissive, to_jsonb(roles) AS roles, cmd AS command,
              qual AS using, with_check AS "withCheck"
       FROM pg_policies
       WHERE schemaname = $1 AND tablename = $2
       ORDER BY policyname`,
      [schemaName, table],
    );
    return rows;
  }

  async createPolicy(table: string, dto: CreatePolicyDto, schema?: string): Promise<void> {
    const schemaName = normalizeSchema(schema);
    await this.requireTable(table, schemaName);
    const roles = dto.roles && dto.roles.length > 0 ? dto.roles.map((r) => this.formatRole(r)).join(', ') : 'public';

    let sql = `CREATE POLICY ${this.db.quoteIdent(dto.name)} ON ${qualifiedName(schemaName, table)} FOR ${dto.command} TO ${roles}`;
    // USING/WITH CHECK are boolean SQL expressions, not values — Postgres has no way to
    // parameterize them in DDL, so they're interpolated as-is (same trust model as the SQL Editor).
    if (dto.using && dto.using.trim()) sql += ` USING (${dto.using})`;
    if (dto.withCheck && dto.withCheck.trim()) sql += ` WITH CHECK (${dto.withCheck})`;

    try {
      await this.db.query(sql);
    } catch (err) {
      throw ApplicationError.fromDriver(err);
    }
  }

  async dropPolicy(table: string, name: string, schema?: string): Promise<void> {
    const schemaName = normalizeSchema(schema);
    await this.requireTable(table, schemaName);
    try {
      await this.db.query(`DROP POLICY ${this.db.quoteIdent(name)} ON ${qualifiedName(schemaName, table)}`);
    } catch (err) {
      throw ApplicationError.fromDriver(err);
    }
  }
}
