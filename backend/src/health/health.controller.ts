import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HEALTH_APPLICATION, HealthApplication, HealthMetrics } from '@/health/health-service.port';

@Controller('health')
export class HealthController {
  constructor(@Inject(HEALTH_APPLICATION) private readonly health: HealthApplication) {}

  @Get()
  check(): { ok: boolean; connections: HealthMetrics } {
    return this.health.snapshot();
  }

  @Get('live')
  live(): { ok: true } {
    return { ok: true };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response): Promise<{ ok: boolean; connections: HealthMetrics; error?: string }> {
    const result = await this.health.readiness();
    if (!result.ok) {
      response.status(503);
      return { ...result, error: 'Control database is unavailable' };
    }
    return result;
  }

  @Get('metrics')
  metrics(@Res() response: Response): void {
    response.type('text/plain; version=0.0.4').send(this.health.prometheusMetrics());
  }
}
