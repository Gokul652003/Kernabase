import { Module } from '@nestjs/common';
import { TablesController } from '@/tables/tables.controller';
import { TablesService } from '@/tables/tables.service';
import { TenantDatabaseModule } from '@/db/tenant/tenant-database.module';
import { AuthSecurityModule } from '@/auth/auth-security.module';
import { TableMetadataService } from '@/tables/table-metadata.service';
import { TABLES_APPLICATION } from '@/tables/tables-service.port';

@Module({
  imports: [TenantDatabaseModule, AuthSecurityModule],
  controllers: [TablesController],
  providers: [TablesService, TableMetadataService, { provide: TABLES_APPLICATION, useExisting: TablesService }],
  exports: [TABLES_APPLICATION, TableMetadataService],
})
export class TablesModule {}
