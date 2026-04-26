// src/routes/users.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import { prisma } from '@/lib/prisma';
import { updateUserSchema } from '@/validators/index';
import { requireAuthMiddleware } from '@/middleware/auth';
import { getUserTier } from '@/services/tier.service';
import { sanitizeString } from '@/lib/utils';
import type { AppContext } from '@/types/index';

const usersRouter = new Hono<{ Variables: AppContext }>();

/**
 * GET /users/me
 * Get current user profile
 */
usersRouter.get('/me', requireAuthMiddleware, async (c: Context<{ Variables: AppContext }>) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        401
      );
    }

    return c.json({
      success: true,
      data: {
        address: user.address,
        username: user.username,
        bio: user.bio,
        avatar: user.avatar,
        tier: user.tier,
        obsBalance: user.obsBalance,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch profile',
      },
      500
    );
  }
});

/**
 * GET /users/me/tier
 * Get current user tier information
 */
usersRouter.get(
  '/me/tier',
  requireAuthMiddleware,
  async (c: Context<{ Variables: AppContext }>) => {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json(
          {
            success: false,
            error: 'Unauthorized',
          },
          401
        );
      }

      const tierInfo = await getUserTier(user.address);

      return c.json({
        success: true,
        data: {
          tier: tierInfo.tier,
          label: tierInfo.label,
          tokenBalance: user.obsBalance,
        },
      });
    } catch (error) {
      console.error('Error fetching tier:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to fetch tier',
        },
        500
      );
    }
  }
);

/**
 * PUT /users/me
 * Update user profile
 */
usersRouter.put(
  '/me',
  requireAuthMiddleware,
  async (c: Context<{ Variables: AppContext }>) => {
    try {
      const user = c.get('user');
      if (!user) {
        return c.json(
          {
            success: false,
            error: 'Unauthorized',
          },
          401
        );
      }

      const body = await c.req.json().catch(() => ({}));
      const parsed = updateUserSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: 'Invalid request data',
          },
          400
        );
      }

      const { username, bio, avatar } = parsed.data;

      // If username is provided, check for duplicates
      if (username) {
        const existing = await prisma.user.findUnique({
          where: { username },
        });

        if (existing && existing.address !== user.address) {
          return c.json(
            {
              success: false,
              error: 'Username already taken',
            },
            400
          );
        }
      }

      const updated = await prisma.user.update({
        where: { address: user.address },
        data: {
          username: username ? sanitizeString(username) : undefined,
          bio: bio ? sanitizeString(bio) : undefined,
          avatar,
        },
      });

      return c.json({
        success: true,
        data: {
          address: updated.address,
          username: updated.username,
          bio: updated.bio,
          avatar: updated.avatar,
        },
      });
    } catch (error) {
      console.error('Error updating user:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to update profile',
        },
        500
      );
    }
  }
);

/**
 * GET /users/:address
 * Get public profile by wallet address
 */
usersRouter.get('/:address', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const { address } = c.req.param();

    const user = await prisma.user.findUnique({
      where: { address },
      select: {
        address: true,
        username: true,
        bio: true,
        avatar: true,
        tier: true,
        createdAt: true,
        _count: {
          select: {
            feedPosts: true,
            transmissions: true,
          },
        },
      },
    });

    if (!user) {
      return c.json(
        {
          success: false,
          error: 'User not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        ...user,
        postCount: user._count.feedPosts,
        transmissionCount: user._count.transmissions,
      },
    });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch profile',
      },
      500
    );
  }
});

export default usersRouter;
