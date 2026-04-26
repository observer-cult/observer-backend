// src/routes/transmissions.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import { createTransmissionSchema, closeTransmissionSchema } from '@/validators/index';
import { requireAuthMiddleware } from '@/middleware/auth';
import {
  createTransmission,
  getTransmissionWithPnL,
  getAllTransmissions,
  getUserTransmissions,
  closeTransmissionAndRecord,
} from '@/services/transmission.service';
import { getLeaderboard, getUserStats } from '@/services/pnl.service';
import type { AppContext } from '@/types/index';

const transmissionsRouter = new Hono<{ Variables: AppContext }>();

/**
 * GET /transmissions
 * Get all public transmissions sorted by recency
 */
transmissionsRouter.get('/', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const skip = parseInt(c.req.query('skip') || '0', 10);
    const take = Math.min(parseInt(c.req.query('take') || '20', 10), 100);

    const transmissions = await getAllTransmissions(skip, take);

    return c.json({
      success: true,
      data: transmissions,
    });
  } catch (error) {
    console.error('Error fetching transmissions:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch transmissions',
      },
      500
    );
  }
});

/**
 * POST /transmissions
 * Create a transmission
 */
transmissionsRouter.post(
  '/',
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
      const parsed = createTransmissionSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: 'Invalid request data',
          },
          400
        );
      }

      const { tokenAddress, chain, entryPrice, targetPrice } = parsed.data;

      const transmission = await createTransmission(
        user.address,
        tokenAddress,
        chain,
        entryPrice,
        targetPrice
      );

      return c.json(
        {
          success: true,
          data: transmission,
        },
        201
      );
    } catch (error) {
      console.error('Error creating transmission:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to create transmission',
        },
        500
      );
    }
  }
);

/**
 * GET /transmissions/:id
 * Get transmission detail with current PnL
 */
transmissionsRouter.get('/:id', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const { id } = c.req.param();

    const transmission = await getTransmissionWithPnL(id);

    if (!transmission) {
      return c.json(
        {
          success: false,
          error: 'Transmission not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: transmission,
    });
  } catch (error) {
    console.error('Error fetching transmission:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch transmission',
      },
      500
    );
  }
});

/**
 * PUT /transmissions/:id/close
 * Close transmission and record exit price/PnL
 */
transmissionsRouter.put(
  '/:id/close',
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

      const { id } = c.req.param();

      const body = await c.req.json().catch(() => ({}));
      const parsed = closeTransmissionSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: 'Invalid request data',
          },
          400
        );
      }

      const { exitPrice } = parsed.data;

      const transmission = await closeTransmissionAndRecord(id, exitPrice, user.address);

      return c.json({
        success: true,
        data: transmission,
      });
    } catch (error) {
      console.error('Error closing transmission:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to close transmission';

      if (errorMessage.includes('Not authorized')) {
        return c.json(
          {
            success: false,
            error: errorMessage,
          },
          403
        );
      }

      if (errorMessage.includes('not found')) {
        return c.json(
          {
            success: false,
            error: errorMessage,
          },
          404
        );
      }

      return c.json(
        {
          success: false,
          error: errorMessage,
        },
        500
      );
    }
  }
);

/**
 * GET /transmissions/leaderboard
 * Get ranked transmissions by win rate (min 10 calls)
 */
transmissionsRouter.get('/leaderboard', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 500);

    const leaderboard = await getLeaderboard(limit);

    return c.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch leaderboard',
      },
      500
    );
  }
});

export default transmissionsRouter;
