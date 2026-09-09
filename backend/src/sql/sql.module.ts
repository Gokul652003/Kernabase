import { Module } from '@nestjs/common';
import { SqlController } from '@/sql/sql.controller';
import { SqlService } from '@/sql/sql.service';
import { TenantDatabaseModule } from '@/db/tenant/tenant-database.module';
import { AuthSecurityModule } from '@/auth/auth-security.module';
import { ConfigModule } from '@/config/config.module';
import { SQL_APPLICATION } from '@/sql/sql-service.port';

@Module({
  imports: [TenantDatabaseModule, AuthSecurityModule, ConfigModule],
  controllers: [SqlController],
  providers: [SqlService, { provide: SQL_APPLICATION, useExisting: SqlService }],
})
export class SqlModule {}
