import { Module } from '@nestjs/common';
import { AppConfig } from '@/config/app-config.service';

@Module({ providers: [AppConfig], exports: [AppConfig] })
export class ConfigModule {}
