import { ApplicationError } from '@/common/errors/application.error';
import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { AppConfig } from '@/config/app-config.service';
import { RequestPrincipal } from '@/common/http/authed-request';

export type AuthTokenPayload = RequestPrincipal;

@Injectable()
export class TokenService {
  constructor(private readonly config: AppConfig) {}

  issue(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.config.jwtSecret, { expiresIn: this.config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
  }

  verify(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, this.config.jwtSecret) as AuthTokenPayload;
    } catch {
      throw ApplicationError.unauthorized('Invalid or expired token');
    }
  }
}
