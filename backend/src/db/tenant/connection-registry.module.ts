import { Module } from '@nestjs/common';
import { ConfigModule } from '@/config/config.module';
import { ConnectionRegistry } from '@/db/tenant/connection-registry.service';
import { POOL_METRICS_READER, PROJECT_POOL_INVALIDATOR } from '@/db/tenant/database.ports';

@Module({
  imports: [ConfigModule],
  providers: [
    ConnectionRegistry,
    { provide: POOL_METRICS_READER, useExisting: ConnectionRegistry },
    { provide: PROJECT_POOL_INVALIDATOR, useExisting: ConnectionRegistry },
  ],
  exports: [ConnectionRegistry, POOL_METRICS_READER, PROJECT_POOL_INVALIDATOR],
})
export class ConnectionRegistryModule {}
