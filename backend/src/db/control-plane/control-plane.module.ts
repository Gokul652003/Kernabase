import { Module } from '@nestjs/common';
import { ConfigModule } from '@/config/config.module';
import { ConnectionRegistryModule } from '@/db/tenant/connection-registry.module';
import { controlPlanePoolProvider } from '@/db/control-plane/control-plane.pool';
import { ConnectionBudgetGuard } from '@/db/tenant/connection-budget.guard';
import {
  DATABASE_CONNECTION_TESTER,
  MANAGED_DATABASE_ADMIN,
  PROJECT_REPOSITORY,
  USER_REPOSITORY,
} from '@/db/control-plane/control-plane.ports';
import { PostgresConnectionTesterAdapter } from '@/db/control-plane/postgres-connection-tester.adapter';
import { PostgresDatabaseAdminAdapter } from '@/db/control-plane/postgres-database-admin.adapter';
import { PostgresProjectRepository } from '@/db/control-plane/postgres-project.repository';
import { PostgresUserRepository } from '@/db/control-plane/postgres-user.repository';

/** Binds each control-plane port to exactly one PostgreSQL adapter. */
@Module({
  imports: [ConnectionRegistryModule, ConfigModule],
  providers: [
    controlPlanePoolProvider,
    ConnectionBudgetGuard,
    { provide: USER_REPOSITORY, useClass: PostgresUserRepository },
    { provide: PROJECT_REPOSITORY, useClass: PostgresProjectRepository },
    { provide: DATABASE_CONNECTION_TESTER, useClass: PostgresConnectionTesterAdapter },
    { provide: MANAGED_DATABASE_ADMIN, useClass: PostgresDatabaseAdminAdapter },
  ],
  exports: [
    USER_REPOSITORY,
    PROJECT_REPOSITORY,
    DATABASE_CONNECTION_TESTER,
    MANAGED_DATABASE_ADMIN,
  ],
})
export class ControlPlaneModule {}
