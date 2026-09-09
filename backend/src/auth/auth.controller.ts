import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from '@/auth/auth.guard';
import { SignupDto } from '@/auth/dto/signup.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { AUTH_APPLICATION, AuthApplication } from '@/auth/auth-service.port';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_APPLICATION) private readonly auth: AuthApplication) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto.email, dto.password);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user!.userId);
  }
}
