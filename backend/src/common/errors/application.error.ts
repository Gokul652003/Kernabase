export type ApplicationErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'service_unavailable';

/**
 * Transport-neutral error raised by the application layer.
 *
 * Services must never throw HTTP exceptions: the same services are driven by more than
 * one adapter (REST controllers and the MCP tool layer today), and an HTTP status is
 * meaningless to a non-HTTP caller. Adapters translate this into their own vocabulary —
 * `ApplicationErrorFilter` maps `code` to a status for HTTP, `mcp-tools` renders it as
 * a tool error result.
 */
export class ApplicationError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }

  static badRequest(message: string, cause?: unknown): ApplicationError {
    return new ApplicationError('bad_request', message, cause);
  }

  static unauthorized(message = 'Unauthorized', cause?: unknown): ApplicationError {
    return new ApplicationError('unauthorized', message, cause);
  }

  static forbidden(message: string, cause?: unknown): ApplicationError {
    return new ApplicationError('forbidden', message, cause);
  }

  static notFound(message: string, cause?: unknown): ApplicationError {
    return new ApplicationError('not_found', message, cause);
  }

  static conflict(message: string, cause?: unknown): ApplicationError {
    return new ApplicationError('conflict', message, cause);
  }

  static payloadTooLarge(message: string, cause?: unknown): ApplicationError {
    return new ApplicationError('payload_too_large', message, cause);
  }

  static serviceUnavailable(message: string, cause?: unknown): ApplicationError {
    return new ApplicationError('service_unavailable', message, cause);
  }

  /** Wraps a driver/library failure as a bad request while keeping the original for logs. */
  static fromDriver(error: unknown): ApplicationError {
    if (error instanceof ApplicationError) return error;
    return new ApplicationError('bad_request', (error as Error).message, error);
  }
}
