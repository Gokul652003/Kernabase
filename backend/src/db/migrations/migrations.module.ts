import { Module } from '@nestjs/common';
import { ConnectionRegistryModule } from '@/db/tenant/connection-registry.module';
import { MigrationRunner } from '@/db/migrations/migration-runner.service';

/** Runs pending control-plane migrations on boot. */
@Module({ imports: [ConnectionRegistryModule], providers: [MigrationRunner] })
export class MigrationsModule {}
