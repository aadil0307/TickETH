import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that sanitizes error responses
 * to prevent information leakage in production.
 *
 * - Strips stack traces from production responses
 * - Logs full error details server-side
 * - Returns consistent error shape
 * - Redacts sensitive fields from error details
 */
@Catch()
export class SecurityExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('SecurityExceptionFilter');
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, any>;
        message = resp.message || exception.message;
        errorCode = resp.error || errorCode;
      }
    } else if (!this.isProduction && exception instanceof Error) {
      message = exception.message || message;
    }

    // Log full error details server-side
    const requestId = request.headers['x-request-id'] as string;
    const logPayload = {
      requestId,
      method: request.method,
      url: request.originalUrl,
      status,
      ip: request.ip,
      error: exception instanceof Error ? exception.message : String(exception),
    };

    if (status >= 500) {
      this.logger.error(
        JSON.stringify(logPayload),
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status === 429) {
      this.logger.warn(`RATE_LIMITED ${JSON.stringify(logPayload)}`);
    } else if (status >= 400) {
      this.logger.warn(JSON.stringify(logPayload));
    }

    // Build sanitized response
    const errorResponse: Record<string, any> = {
      statusCode: status,
      error: errorCode,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    // Include request ID for correlation
    if (requestId) {
      errorResponse.requestId = requestId;
    }

    // Never expose stack traces or internal details in production
    if (!this.isProduction && exception instanceof Error) {
      errorResponse.stack = exception.stack;
    }

    response.status(status).json(errorResponse);
  }
}
