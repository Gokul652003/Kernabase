import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { AuthedRequest } from '@/common/http/authed-request';
import { runInTenantContext } from '@/db/tenant/tenant-context';

/** Opens the AsyncLocalStorage scope that tenant-database resolution reads from. */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: AuthedRequest, _res: Response, next: NextFunction): void {
    runInTenantContext(req, next);
  }
}
