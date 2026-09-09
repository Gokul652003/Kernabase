import { Module } from '@nestjs/common';
import { PoliciesController } from '@/policies/policies.controller';
import { PoliciesService } from '@/policies/policies.service';
import { TenantDatabaseModule } from '@/db/tenant/tenant-database.module';
import { AuthSecurityModule } from '@/auth/auth-security.module';
import { TablesModule } from '@/tables/tables.module';
import { POLICIES_APPLICATION } from '@/policies/policies-service.port';

@Module({
  imports: [TenantDatabaseModule, AuthSecurityModule, TablesModule],
  controllers: [PoliciesController],
  providers: [PoliciesService, { provide: POLICIES_APPLICATION, useExisting: PoliciesService }],
})
export class PoliciesModule {}
