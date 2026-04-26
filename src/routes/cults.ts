// src/routes/cults.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import { prisma } from '@/lib/prisma';
import { createCultSchema } from '@/validators/index';
import { requireAuthMiddleware } from '@/middleware/auth';
import { requireTierMiddleware } from '@/middleware/tier';
import {
  createCult,
  getCultDetail,
  listCults,
  joinCult,
  leaveCult,
  isCultMember,
  checkTierRequirement,
} from '@/services/cult.service';
import {
  createTransmission,
  postCultTransmission,
} from '@/services/transmission.service';
import { createTransmissionSchema } from '@/validators/index';
import { sanitizeString } from '@/lib/utils';
import type { AppContext } from '@/types/index';

const cultsRouter = new Hono<{ Variables: AppContext }>();

/**
 * GET /cults
 * List all cults with optional tier filter
 */
cultsRouter.get('/', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const skip = parseInt(c.req.query('skip') || '0', 10);
    const take = Math.min(parseInt(c.req.query('take') || '20', 10), 100);

    const cults = await listCults(skip, take);

    return c.json({
      success: true,
      data: cults,
    });
  } catch (error) {
    console.error('Error listing cults:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to list cults',
      },
      500
    );
  }
});

/**
 * POST /cults
 * Create a new cult (tier 3+ only)
 */
cultsRouter.post(
  '/',
  requireAuthMiddleware,
  requireTierMiddleware(3),
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
      const parsed = createCultSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: 'Invalid request data',
          },
          400
        );
      }

      const { name, description, minTier } = parsed.data;

      const cult = await createCult(
        sanitizeString(name),
        description ? sanitizeString(description) : undefined,
        minTier,
        user.address
      );

      return c.json(
        {
          success: true,
          data: cult,
        },
        201
      );
    } catch (error) {
      console.error('Error creating cult:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to create cult',
        },
        500
      );
    }
  }
);

/**
 * GET /cults/:id
 * Get cult details with members and recent transmissions
 */
cultsRouter.get('/:id', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const { id } = c.req.param();

    const cult = await getCultDetail(id);

    if (!cult) {
      return c.json(
        {
          success: false,
          error: 'Cult not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: cult,
    });
  } catch (error) {
    console.error('Error fetching cult detail:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch cult',
      },
      500
    );
  }
});

/**
 * POST /cults/:id/join
 * Join cult if user meets tier requirement
 */
cultsRouter.post(
  '/:id/join',
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

      // Get cult
      const cult = await getCultDetail(id);
      if (!cult) {
        return c.json(
          {
            success: false,
            error: 'Cult not found',
          },
          404
        );
      }

      // Check tier requirement
      const meetsRequirement = await checkTierRequirement(user.tier, cult);
      if (!meetsRequirement) {
        return c.json(
          {
            success: false,
            error: `Insufficient tier. Required: ${cult.minTier}`,
          },
          403
        );
      }

      // Join cult
      await joinCult(id, user.address);

      return c.json({
        success: true,
        data: {
          message: 'Successfully joined cult',
        },
      });
    } catch (error) {
      console.error('Error joining cult:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to join cult';

      if (errorMessage.includes('member')) {
        return c.json(
          {
            success: false,
            error: errorMessage,
          },
          400
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
 * POST /cults/:id/leave
 * Leave cult
 */
cultsRouter.post(
  '/:id/leave',
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

      // Leave cult
      await leaveCult(id, user.address);

      return c.json({
        success: true,
        data: {
          message: 'Successfully left cult',
        },
      });
    } catch (error) {
      console.error('Error leaving cult:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave cult';

      return c.json(
        {
          success: false,
          error: errorMessage,
        },
        400
      );
    }
  }
);

/**
 * POST /cults/:id/transmit
 * Post transmission inside cult
 */
cultsRouter.post(
  '/:id/transmit',
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

      // Check if user is cult member
      const isMember = await isCultMember(id, user.address);
      if (!isMember) {
        return c.json(
          {
            success: false,
            error: 'Not a member of this cult',
          },
          403
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

      const transmission = await postCultTransmission(
        id,
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
      console.error('Error posting transmission:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to post transmission',
        },
        500
      );
    }
  }
);

export default cultsRouter;
