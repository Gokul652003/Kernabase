import type { Request } from 'express';

/** The authenticated principal attached to a request by an auth guard. */
export interface RequestPrincipal {
  userId: string;
  email: string;
}

export interface AuthedRequest extends Request {
  user?: RequestPrincipal;
}
