// src/middleware/rateLimit.ts
import type { Context, Next } from 'hono';
import { cacheManager } from '@/lib/redis';
import type { AppContext } from '@/types/index';

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

/**
 * Rate limit middleware
 * 100 requests per minute per wallet address
 */
export async function rateLimitMiddleware(
  c: Context<{ Variables: AppContext }>,
  next: Next
) {
  const user = c.get('user');
  const identifier = user?.address || c.req.header('x-forwarded-for') || 'unknown';

  const key = `rate-limit:${identifier}`;

  try {
    const count = await cacheManager.incrementRateLimit(key);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - count).toString());

    if (count > RATE_LIMIT_MAX_REQUESTS) {
      return c.json(
        {
          success: false,
          error: 'Rate limit exceeded. Max 100 requests per minute.',
        },
        429
      );
    }

    return next();
  } catch (error) {
    console.error('Rate limit error:', error);
    // Allow request if rate limit check fails
    return next();
  }
}

/**
 * Custom rate limit middleware with configurable limits
 */
export function createRateLimitMiddleware(
  maxRequests: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
) {
  return async (c: Context<{ Variables: AppContext }>, next: Next) => {
    const user = c.get('user');
    const identifier = user?.address || c.req.header('x-forwarded-for') || 'unknown';

    const key = `rate-limit:${identifier}:${Math.floor(Date.now() / windowMs)}`;

    try {
      const count = await cacheManager.incrementRateLimit(key);

      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());

      if (count > maxRequests) {
        return c.json(
          {
            success: false,
            error: `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs}ms.`,
          },
          429
        );
      }

      return next();
    } catch (error) {
      console.error('Rate limit error:', error);
      return next();
    }
  };
}
