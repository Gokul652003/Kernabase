import { ApplicationError } from '@/common/errors/application.error';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TokenService } from '@/auth/token.service';
import { AuthedRequest } from '@/common/http/authed-request';

export type { AuthedRequest } from '@/common/http/authed-request';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw ApplicationError.unauthorized('Missing authorization token');
    }
    const token = header.slice('Bearer '.length);
    req.user = this.tokens.verify(token);
    return true;
  }
}
