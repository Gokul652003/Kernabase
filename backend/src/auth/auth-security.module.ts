import { Module } from '@nestjs/common';
import { ConfigModule } from '@/config/config.module';
import { AuthGuard } from '@/auth/auth.guard';
import { TokenService } from '@/auth/token.service';

@Module({ imports: [ConfigModule], providers: [TokenService, AuthGuard], exports: [TokenService, AuthGuard] })
export class AuthSecurityModule {}
