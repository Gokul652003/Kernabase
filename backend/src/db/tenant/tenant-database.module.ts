import { Module } from '@nestjs/common';
import { ControlPlaneModule } from '@/db/control-plane/control-plane.module';
import { ConnectionRegistryModule } from '@/db/tenant/connection-registry.module';
import { PROJECT_CONNECTION_READER, PROJECT_DATABASE } from '@/db/tenant/database.ports';
import { ProjectConnectionReaderAdapter } from '@/db/tenant/project-connection.reader';
import { TenantDatabaseService } from '@/db/tenant/tenant-database.service';

@Module({
  imports: [ControlPlaneModule, ConnectionRegistryModule],
  providers: [
    TenantDatabaseService,
    { provide: PROJECT_CONNECTION_READER, useClass: ProjectConnectionReaderAdapter },
    { provide: PROJECT_DATABASE, useExisting: TenantDatabaseService },
  ],
  exports: [PROJECT_DATABASE],
})
export class TenantDatabaseModule {}
