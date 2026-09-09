import { Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { ApplicationErrorFilter } from '@/common/errors/application-error.filter';
import { AppConfig } from '@/config/app-config.service';

/**
 * Every cross-cutting HTTP concern, in one place.
 *
 * `main.ts` and the e2e tests both call this so a test can never pass against a
 * differently-configured app than the one that ships.
 */
export function configureApp(app: INestApplication, config: AppConfig): void {
  app.use(json({ limit: config.http.bodyLimit }));
  app.use(urlencoded({ extended: true, limit: config.http.bodyLimit }));
  app.enableCors({ origin: config.http.corsOrigins, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApplicationErrorFilter());
  app.enableShutdownHooks();
}

export function logStartup(port: number): void {
  new Logger('Bootstrap').log(`Kernabase backend listening on http://localhost:${port}/api`);
}
