import { Module } from '@nestjs/common';
import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { AuthSecurityModule } from '@/auth/auth-security.module';
import { ControlPlaneModule } from '@/db/control-plane/control-plane.module';
import { AUTH_APPLICATION } from '@/auth/auth-service.port';

@Module({
  imports: [ControlPlaneModule, AuthSecurityModule],
  controllers: [AuthController],
  providers: [AuthService, { provide: AUTH_APPLICATION, useExisting: AuthService }],
  exports: [AUTH_APPLICATION],
})
export class AuthModule {}
