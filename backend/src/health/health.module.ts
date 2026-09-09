import { Module } from '@nestjs/common';
import { ConnectionRegistryModule } from '@/db/tenant/connection-registry.module';
import { HealthController } from '@/health/health.controller';
import { HealthService } from '@/health/health.service';
import { HEALTH_APPLICATION } from '@/health/health-service.port';

@Module({
  imports: [ConnectionRegistryModule],
  controllers: [HealthController],
  providers: [HealthService, { provide: HEALTH_APPLICATION, useExisting: HealthService }],
})
export class HealthModule {}
