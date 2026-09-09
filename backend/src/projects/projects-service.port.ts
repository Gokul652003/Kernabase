import { CreateProjectDto } from '@/projects/dto/create-project.dto';
import { ProjectSummary, ProvisionedProject } from '@/projects/projects.types';

export const PROJECTS_APPLICATION = Symbol('PROJECTS_APPLICATION');

export interface ProjectsApplication {
  list(userId: string): Promise<ProjectSummary[]>;
  createManaged(userId: string, name: string): Promise<ProvisionedProject>;
  create(userId: string, dto: CreateProjectDto, isManaged?: boolean): Promise<ProjectSummary>;
  get(projectId: string, userId: string): Promise<ProjectSummary>;
  update(projectId: string, userId: string, name: string): Promise<ProjectSummary>;
  remove(projectId: string, userId: string): Promise<void>;
  regeneratePassword(projectId: string, userId: string): Promise<string>;
  regenerateMcpToken(projectId: string, userId: string): Promise<string>;
  revokeMcpToken(projectId: string, userId: string): Promise<void>;
  updateMcpPermissions(projectId: string, userId: string, allowWrite: boolean, allowSchema: boolean): Promise<ProjectSummary>;
  verifyMcpToken(projectId: string, token: string): Promise<{ ownerId: string; allowWrite: boolean; allowSchema: boolean } | null>;
}
