import { Inject, Injectable } from '@nestjs/common';
import { ApplicationError } from '@/common/errors/application.error';
import { PROJECT_REPOSITORY, type ProjectRepository } from '@/db/control-plane/control-plane.ports';
import { ProjectConnectionInfo, ProjectConnectionReader } from '@/db/tenant/database.ports';

/**
 * Resolves the credentials for the project a request is addressing.
 *
 * This lives in the db layer rather than in `projects/` on purpose: tenant routing is
 * infrastructure, and reading a project's stored connection row is a control-plane
 * concern. Routing through the projects feature would make the db layer depend on a
 * feature, inverting the dependency direction the rest of the codebase follows.
 *
 * The ownership check is the security boundary — a project is only reachable by the
 * user who owns it, and an unowned id is reported as missing rather than forbidden so
 * the endpoint cannot be used to enumerate other people's projects.
 */
@Injectable()
export class ProjectConnectionReaderAdapter implements ProjectConnectionReader {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository) {}

  async getConnectionInfo(projectId: string, userId: string | undefined): Promise<ProjectConnectionInfo> {
    if (!userId) throw ApplicationError.forbidden('Not authenticated');
    const info = await this.projects.connectionInfo(projectId, userId);
    if (!info) throw ApplicationError.notFound('Project not found');
    return info;
  }
}
