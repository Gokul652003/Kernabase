import { Controller, Delete, Get, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { PROJECTS_APPLICATION, ProjectsApplication } from '@/projects/projects-service.port';
import { SCHEMAS_APPLICATION, SchemasApplication } from '@/schemas/schemas-service.port';
import { TABLES_APPLICATION, TablesApplication } from '@/tables/tables-service.port';
import { McpAuthedRequest, McpAuthGuard } from '@/mcp/mcp-auth.guard';
import { buildMcpServer } from '@/mcp/mcp-tools';

// Stateless Streamable HTTP: a fresh McpServer/transport per request, no session
// persistence. The injected application services are singletons; the tenant they act on
// comes from the AsyncLocalStorage scope opened by TenantContextMiddleware, which reads
// req.params.projectId and the user McpAuthGuard resolved from the MCP token.
@UseGuards(McpAuthGuard)
@Controller('projects/:projectId/mcp')
export class McpController {
  constructor(
    @Inject(TABLES_APPLICATION) private readonly tables: TablesApplication,
    @Inject(SCHEMAS_APPLICATION) private readonly schemas: SchemasApplication,
    @Inject(PROJECTS_APPLICATION) private readonly projects: ProjectsApplication,
  ) {}

  @Post()
  async handlePost(@Req() req: McpAuthedRequest, @Res() res: Response, @Param('projectId') projectId: string) {
    const project = await this.projects.get(projectId, req.user!.userId);
    const mcpServer = buildMcpServer(this.tables, this.schemas, project.name, req.mcpPermissions!);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      mcpServer.close();
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  @Get()
  @Delete()
  disallow(@Res() res: Response) {
    res.status(405).json({ message: 'This MCP endpoint only supports stateless POST requests.' });
  }
}
