import 'reflect-metadata';
// Loaded before anything reads configuration, so a local .env behaves the same way the
// environment variables set by docker-compose do. Real environment variables always win.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { configureApp, logStartup } from '@/bootstrap';
import { AppConfig } from '@/config/app-config.service';

async function start(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(AppConfig);
  configureApp(app, config);
  await app.listen(config.port);
  logStartup(config.port);
}

void start();
