import { Module } from '@nestjs/common';
import { SchemasController } from '@/schemas/schemas.controller';
import { SchemasService } from '@/schemas/schemas.service';
import { TenantDatabaseModule } from '@/db/tenant/tenant-database.module';
import { AuthSecurityModule } from '@/auth/auth-security.module';
import { SCHEMAS_APPLICATION } from '@/schemas/schemas-service.port';

@Module({
  imports: [TenantDatabaseModule, AuthSecurityModule],
  controllers: [SchemasController],
  providers: [SchemasService, { provide: SCHEMAS_APPLICATION, useExisting: SchemasService }],
  exports: [SCHEMAS_APPLICATION],
})
export class SchemasModule {}
