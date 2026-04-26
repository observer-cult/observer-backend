// src/middleware/tier.ts
import type { Context, Next } from 'hono';
import type { AppContext } from '@/types/index';

/**
 * Tier requirement middleware
 * Returns 403 if user's tier is less than required
 */
export function requireTierMiddleware(requiredTier: number) {
  return async (c: Context<{ Variables: AppContext }>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    if (user.tier < requiredTier) {
      return c.json(
        {
          success: false,
          error: `Insufficient tier. Required: ${requiredTier}, Your tier: ${user.tier}`,
        },
        403
      );
    }

    return next();
  };
}

/**
 * Admin/high-tier middleware (requires T3+)
 */
export function requireHighTierMiddleware(
  c: Context<{ Variables: AppContext }>,
  next: Next
) {
  const user = c.get('user');

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  // T3 is minimum for administrative actions
  if (user.tier < 3) {
    return c.json(
      {
        success: false,
        error: 'Insufficient tier. Admin tier required (T3+)',
      },
      403
    );
  }

  return next();
}
