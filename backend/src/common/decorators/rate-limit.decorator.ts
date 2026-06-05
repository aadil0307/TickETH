import { SetMetadata } from '@nestjs/common';

/**
 * Throttle configuration metadata key.
 * Used by the ThrottlerModule to apply per-route rate limits.
 */
export const THROTTLE_LIMIT = 'THROTTLE_LIMIT';
export const THROTTLE_TTL = 'THROTTLE_TTL';

/**
 * Custom decorator for setting per-endpoint rate limits.
 * Overrides the global throttler config for specific routes.
 *
 * @param limit - Max requests in the window
 * @param ttl - Time window in seconds
 *
 * @example
 * @RateLimit(5, 60) // 5 requests per 60 seconds
 * @Post('auth/verify')
 */
export const RateLimit = (limit: number, ttl: number) =>
  SetMetadata('throttler', { limit, ttl: ttl * 1000 });

/**
 * Skip throttling for a specific route.
 */
export const SkipThrottle = () => SetMetadata('skipThrottle', true);
