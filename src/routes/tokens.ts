// src/routes/tokens.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import { getTokenInfo, getTokenPrice } from '@/services/token.service';
import type { AppContext } from '@/types/index';

const tokensRouter = new Hono<{ Variables: AppContext }>();

/**
 * GET /tokens/lookup/:address
 * Get token name, symbol, decimals
 */
tokensRouter.get('/lookup/:address', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const { address } = c.req.param();

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return c.json(
        {
          success: false,
          error: 'Invalid token address',
        },
        400
      );
    }

    const tokenInfo = await getTokenInfo(address);

    if (!tokenInfo) {
      return c.json(
        {
          success: false,
          error: 'Token not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: tokenInfo,
    });
  } catch (error) {
    console.error('Error fetching token info:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch token info',
      },
      500
    );
  }
});

/**
 * GET /tokens/price/:address
 * Get current price of token
 */
tokensRouter.get('/price/:address', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const { address } = c.req.param();

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return c.json(
        {
          success: false,
          error: 'Invalid token address',
        },
        400
      );
    }

    const price = await getTokenPrice(address);

    if (price === null) {
      return c.json(
        {
          success: false,
          error: 'Price data not available',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        address,
        price,
        currency: 'USD',
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('Error fetching token price:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch price',
      },
      500
    );
  }
});

export default tokensRouter;
