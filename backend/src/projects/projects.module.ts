import { Module } from '@nestjs/common';
import { ProjectsController } from '@/projects/projects.controller';
import { ProjectsService } from '@/projects/projects.service';
import { ConnectionTargetPolicy } from '@/projects/connection-target.policy';
import { ConfigModule } from '@/config/config.module';
import { AuthSecurityModule } from '@/auth/auth-security.module';
import { ControlPlaneModule } from '@/db/control-plane/control-plane.module';
import { ConnectionRegistryModule } from '@/db/tenant/connection-registry.module';
import { PROJECTS_APPLICATION } from '@/projects/projects-service.port';

@Module({
  imports: [ControlPlaneModule, ConnectionRegistryModule, ConfigModule, AuthSecurityModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ConnectionTargetPolicy,
    { provide: PROJECTS_APPLICATION, useExisting: ProjectsService },
  ],
  exports: [PROJECTS_APPLICATION],
})
export class ProjectsModule {}
