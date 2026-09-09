import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ConfigModule } from '@/config/config.module';
import { HttpHardeningMiddleware } from '@/common/http/http-hardening.middleware';
import { ConnectionRegistryModule } from '@/db/tenant/connection-registry.module';
import { TenantDatabaseModule } from '@/db/tenant/tenant-database.module';
import { TenantContextMiddleware } from '@/db/tenant/tenant-context.middleware';
import { MigrationsModule } from '@/db/migrations/migrations.module';
import { HealthModule } from '@/health/health.module';
import { McpModule } from '@/mcp/mcp.module';
import { PoliciesModule } from '@/policies/policies.module';
import { ProjectsModule } from '@/projects/projects.module';
import { SchemasModule } from '@/schemas/schemas.module';
import { SqlModule } from '@/sql/sql.module';
import { TablesModule } from '@/tables/tables.module';

@Module({
  imports: [
    ConfigModule,
    ConnectionRegistryModule,
    MigrationsModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    TenantDatabaseModule,
    TablesModule,
    SqlModule,
    PoliciesModule,
    SchemasModule,
    McpModule,
  ],
  providers: [HttpHardeningMiddleware, TenantContextMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Order matters: the tenant scope must be open before any handler runs.
    consumer.apply(HttpHardeningMiddleware, TenantContextMiddleware).forRoutes('*');
  }
}
