import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ApplicationError, ApplicationErrorCode } from '@/common/errors/application.error';

const STATUS: Record<ApplicationErrorCode, HttpStatus> = {
  bad_request: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  payload_too_large: HttpStatus.PAYLOAD_TOO_LARGE,
  service_unavailable: HttpStatus.SERVICE_UNAVAILABLE,
};

/** The single place where an application error code becomes an HTTP status. */
@Catch(ApplicationError)
export class ApplicationErrorFilter implements ExceptionFilter<ApplicationError> {
  catch(error: ApplicationError, host: ArgumentsHost): void {
    const status = STATUS[error.code];
    const response = host.switchToHttp().getResponse<Response>();
    response.status(status).json({ statusCode: status, message: error.message, error: error.code });
  }
}
