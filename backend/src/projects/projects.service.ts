import { ApplicationError } from '@/common/errors/application.error';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { AppConfig } from '@/config/app-config.service';
import { CreateProjectDto } from '@/projects/dto/create-project.dto';
import { ConnectionTargetPolicy } from '@/projects/connection-target.policy';
import { ProjectConnectionTarget, ProjectSummary } from '@/projects/projects.types';
import { ProjectsApplication } from '@/projects/projects-service.port';
import {
  DATABASE_CONNECTION_TESTER, DatabaseConnectionTester, MANAGED_DATABASE_ADMIN, ManagedDatabaseAdmin,
  PROJECT_POOL_INVALIDATOR, PROJECT_REPOSITORY, ProjectPoolInvalidator, ProjectRecord, ProjectRepository,
} from '@/db/control-plane/control-plane.ports';

// MCP tokens are bearer credentials handed to external tools (Claude Desktop, etc.), so like
// db passwords they're never stored in plaintext — only a hash, checked in constant time.
function hashMcpToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class ProjectsService implements ProjectsApplication {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(DATABASE_CONNECTION_TESTER) private readonly connectionTester: DatabaseConnectionTester,
    @Inject(MANAGED_DATABASE_ADMIN) private readonly databaseAdmin: ManagedDatabaseAdmin,
    @Inject(PROJECT_POOL_INVALIDATOR) private readonly poolInvalidator: ProjectPoolInvalidator,
    private readonly connectionTargets: ConnectionTargetPolicy,
    private readonly config: AppConfig,
  ) {}

  /**
   * Adds the address an outside client should use, which is not what is stored.
   *
   * A managed project records the host this process reaches PostgreSQL on — a Docker
   * service name. An unmanaged project already records an address the user gave us, so
   * that one is reported as-is.
   */
  private withConnection(project: ProjectRecord): ProjectSummary {
    return { ...project, connection: this.connectionTarget(project) };
  }

  private connectionTarget(project: ProjectRecord): ProjectConnectionTarget | null {
    if (!project.isManaged) {
      return { host: project.host, port: project.port, database: project.database, user: project.dbUser };
    }
    // Not published, so there is no address to hand out.
    if (!this.config.tenantPublicHost) return null;
    return {
      host: this.config.tenantPublicHost,
      port: this.config.tenantPublicPort,
      database: project.database,
      user: project.dbUser,
    };
  }

  async list(userId: string): Promise<ProjectSummary[]> {
    return (await this.projects.listOwned(userId)).map((project) => this.withConnection(project));
  }

  async createManaged(userId: string, name: string): Promise<ProjectSummary> {
    // Checked before CREATE ROLE, so a refused request leaves nothing behind. This is a
    // best-effort cap: two simultaneous requests can both pass it, which costs one extra
    // database rather than anything unbounded.
    const existing = await this.projects.countManaged(userId);
    const limit = this.config.maxManagedProjectsPerUser;
    if (existing >= limit) {
      throw ApplicationError.badRequest(
        `You already have ${existing} of ${limit} databases. Delete one first, or connect an existing database instead.`,
      );
    }

    const suffix = randomBytes(10).toString('hex');
    const roleName = `tenant_${suffix}`;
    const database = `tenant_db_${suffix}`;
    const password = randomBytes(24).toString('base64url');

    await this.databaseAdmin.createRole(roleName, password);
    try {
      await this.databaseAdmin.createDatabase(database, roleName);
      return await this.create(userId, {
        name,
        host: this.config.postgres.host,
        port: this.config.postgres.port,
        database,
        dbUser: roleName,
        dbPassword: password,
      }, true);
    } catch (err) {
      await this.databaseAdmin.dropDatabase(database).catch(() => {});
      await this.databaseAdmin.dropRole(roleName).catch(() => {});
      throw err;
    }
  }

  async create(userId: string, dto: CreateProjectDto, isManaged = false): Promise<ProjectSummary> {
    // Managed projects are provisioned by us and deliberately live on the configured
    // server; only user-supplied targets are screened. The check runs before
    // assertConnectable so a refused host is never dialled at all.
    if (!isManaged) await this.connectionTargets.assertAllowed(dto.host, dto.port, dto.database);
    await this.connectionTester.assertConnectable(dto);
    return this.withConnection(await this.projects.createProject(userId, dto, isManaged));
  }

  async get(projectId: string, userId: string): Promise<ProjectSummary> {
    const project = await this.projects.findOwned(projectId, userId);
    if (!project) throw ApplicationError.notFound('Project not found');
    return this.withConnection(project);
  }

  async update(projectId: string, userId: string, name: string): Promise<ProjectSummary> {
    const project = await this.projects.rename(projectId, userId, name);
    if (!project) throw ApplicationError.notFound('Project not found');
    return this.withConnection(project);
  }

  async remove(projectId: string, userId: string): Promise<void> {
    const row = await this.projects.findOwnedResource(projectId, userId);
    if (!row) throw ApplicationError.notFound('Project not found');

    await this.projects.deleteOwned(projectId, userId);
    await this.poolInvalidator.invalidateProject(projectId);

    // Managed databases are ours to clean up — an unmanaged (user-supplied) connection
    // is left completely untouched, we only ever forget it was saved here.
    if (row.isManaged) {
      await this.databaseAdmin.dropDatabase(row.database)
        .catch((err) => this.logger.warn(`Failed to drop managed database ${row.database}: ${(err as Error).message}`));
      await this.databaseAdmin.dropRole(row.dbUser)
        .catch((err) => this.logger.warn(`Failed to drop managed role ${row.dbUser}: ${(err as Error).message}`));
    }
  }

  // Managed database passwords are never stored or shown in plaintext after creation —
  // rotating is the only way to get a usable password again, same as most API secret keys.
  async regeneratePassword(projectId: string, userId: string): Promise<string> {
    const row = await this.projects.findOwnedResource(projectId, userId);
    if (!row) throw ApplicationError.notFound('Project not found');
    if (!row.isManaged) throw ApplicationError.badRequest('Only managed projects support password regeneration');

    const newPassword = randomBytes(24).toString('base64url');
    await this.databaseAdmin.changeRolePassword(row.dbUser, newPassword);
    await this.projects.updatePassword(projectId, newPassword);
    // Any pooled connection still using the old password must be dropped so the next
    // query reconnects with the new one instead of failing auth.
    await this.poolInvalidator.invalidateProject(projectId);
    return newPassword;
  }


  // Regenerating (rather than revealing) is the only way to get a usable MCP token,
  // same tradeoff as managed db passwords — we only ever keep the hash.
  async regenerateMcpToken(projectId: string, userId: string): Promise<string> {
    const token = `mcp_${randomBytes(24).toString('base64url')}`;
    if (!(await this.projects.setMcpTokenHash(projectId, userId, hashMcpToken(token)))) {
      throw ApplicationError.notFound('Project not found');
    }
    return token;
  }

  async revokeMcpToken(projectId: string, userId: string): Promise<void> {
    if (!(await this.projects.setMcpTokenHash(projectId, userId, null))) throw ApplicationError.notFound('Project not found');
  }

  async updateMcpPermissions(projectId: string, userId: string, allowWrite: boolean, allowSchema: boolean): Promise<ProjectSummary> {
    const project = await this.projects.setMcpPermissions(projectId, userId, allowWrite, allowSchema);
    if (!project) throw ApplicationError.notFound('Project not found');
    return this.withConnection(project);
  }

  // Returns the owning user's id and permission flags if the token is valid for this
  // project, otherwise null. Used by McpAuthGuard to authenticate external MCP clients
  // (no user JWT involved) and to decide which tool categories they may use.
  async verifyMcpToken(
    projectId: string,
    token: string,
  ): Promise<{ ownerId: string; allowWrite: boolean; allowSchema: boolean } | null> {
    const row = await this.projects.findMcpCredential(projectId);
    if (!row || !row.tokenHash) return null;

    const expected = Buffer.from(row.tokenHash, 'hex');
    const actual = Buffer.from(hashMcpToken(token), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    return { ownerId: row.ownerId, allowWrite: row.allowWrite, allowSchema: row.allowSchema };
  }
}
