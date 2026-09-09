import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from '@/auth/auth.guard';
import { CreateProjectDto } from '@/projects/dto/create-project.dto';
import { CreateManagedProjectDto } from '@/projects/dto/create-managed-project.dto';
import { UpdateProjectDto } from '@/projects/dto/update-project.dto';
import { UpdateMcpPermissionsDto } from '@/projects/dto/update-mcp-permissions.dto';
import { PROJECTS_APPLICATION, ProjectsApplication } from '@/projects/projects-service.port';

@UseGuards(AuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(@Inject(PROJECTS_APPLICATION) private readonly projects: ProjectsApplication) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.projects.list(req.user!.userId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateProjectDto) {
    return this.projects.create(req.user!.userId, dto);
  }

  @Post('managed')
  createManaged(@Req() req: AuthedRequest, @Body() dto: CreateManagedProjectDto) {
    return this.projects.createManaged(req.user!.userId, dto.name);
  }

  @Get(':projectId')
  get(@Req() req: AuthedRequest, @Param('projectId') projectId: string) {
    return this.projects.get(projectId, req.user!.userId);
  }

  @Patch(':projectId')
  update(@Req() req: AuthedRequest, @Param('projectId') projectId: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(projectId, req.user!.userId, dto.name);
  }

  @Delete(':projectId')
  remove(@Req() req: AuthedRequest, @Param('projectId') projectId: string) {
    return this.projects.remove(projectId, req.user!.userId);
  }

  @Post(':projectId/regenerate-password')
  async regeneratePassword(@Req() req: AuthedRequest, @Param('projectId') projectId: string) {
    const password = await this.projects.regeneratePassword(projectId, req.user!.userId);
    return { password };
  }

  @Post(':projectId/mcp-token')
  async regenerateMcpToken(@Req() req: AuthedRequest, @Param('projectId') projectId: string) {
    const token = await this.projects.regenerateMcpToken(projectId, req.user!.userId);
    return { token };
  }

  @Delete(':projectId/mcp-token')
  revokeMcpToken(@Req() req: AuthedRequest, @Param('projectId') projectId: string) {
    return this.projects.revokeMcpToken(projectId, req.user!.userId);
  }

  @Put(':projectId/mcp-permissions')
  updateMcpPermissions(
    @Req() req: AuthedRequest,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateMcpPermissionsDto,
  ) {
    return this.projects.updateMcpPermissions(projectId, req.user!.userId, dto.allowWrite, dto.allowSchema);
  }
}
