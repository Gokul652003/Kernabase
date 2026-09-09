import { ApplicationError } from '@/common/errors/application.error';
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthedRequest } from '@/auth/auth.guard';
import { PROJECTS_APPLICATION, ProjectsApplication } from '@/projects/projects-service.port';

export interface McpPermissions {
  allowWrite: boolean;
  allowSchema: boolean;
}

export interface McpAuthedRequest extends AuthedRequest {
  mcpPermissions?: McpPermissions;
}

// Unlike AuthGuard (user JWT), this authenticates external MCP clients against a
// per-project bearer token, then impersonates that project's owner for the rest
// of the request so TenantDatabaseService/TablesService resolve the right tenant connection.
// It also attaches the project's MCP permission flags so the tool layer can filter
// which tool categories (read/write/schema) this token is allowed to use.
@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(@Inject(PROJECTS_APPLICATION) private readonly projects: ProjectsApplication) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<McpAuthedRequest>();
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw ApplicationError.unauthorized('Missing authorization token');
    }
    const token = header.slice('Bearer '.length);
    const projectId = req.params?.projectId;
    if (!projectId) throw ApplicationError.unauthorized('Missing project');

    const result = await this.projects.verifyMcpToken(projectId, token);
    if (!result) throw ApplicationError.unauthorized('Invalid or revoked MCP token');

    req.user = { userId: result.ownerId, email: '' };
    req.mcpPermissions = { allowWrite: result.allowWrite, allowSchema: result.allowSchema };
    return true;
  }
}
