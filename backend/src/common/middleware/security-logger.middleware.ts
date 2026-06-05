import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Logs every incoming HTTP request with method, URL, IP,
 * user-agent, and response time for security auditing.
 */
@Injectable()
export class SecurityLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private static readonly SKIP_PATHS = ['/api/v1/health', '/health'];

  use(req: Request, res: Response, next: NextFunction) {
    // Skip noisy health check logging
    if (SecurityLoggerMiddleware.SKIP_PATHS.includes(req.originalUrl)) {
      return next();
    }

    const start = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || 'unknown';
    const requestId = req.headers['x-request-id'] as string;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;

      // Log warnings for suspicious patterns
      const logPayload = {
        requestId,
        method,
        url: originalUrl,
        statusCode,
        duration: `${duration}ms`,
        ip: this.getClientIp(req),
        userAgent: userAgent.substring(0, 200), // Truncate long user agents
      };

      if (statusCode >= 500) {
        this.logger.error(JSON.stringify(logPayload));
      } else if (statusCode >= 400) {
        this.logger.warn(JSON.stringify(logPayload));
      } else if (duration > 5000) {
        this.logger.warn(`SLOW_REQUEST ${JSON.stringify(logPayload)}`);
      } else {
        this.logger.log(
          `${method} ${originalUrl} ${statusCode} ${duration}ms`,
        );
      }
    });

    next();
  }

  private getClientIp(req: Request): string {
    // Cloudflare proxy
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string') return cfIp.trim();
    // Standard proxy
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
