// src/routes/analytics.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuthMiddleware } from '@/middleware/auth';
import { getUserPnLHistory, getUserStats } from '@/services/pnl.service';
import { getFeedSentiment } from '@/services/feed.service';
import { getTrendingTokens, getTokenPrices } from '@/services/token.service';
import { prisma } from '@/lib/prisma';
import type { AppContext } from '@/types/index';

const analyticsRouter = new Hono<{ Variables: AppContext }>();

/**
 * GET /analytics/pnl
 * Get user PnL history with chart data
 */
analyticsRouter.get('/pnl', requireAuthMiddleware, async (c: Context<{ Variables: AppContext }>) => {
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

    const days = Math.min(parseInt(c.req.query('days') || '30', 10), 365);

    const history = await getUserPnLHistory(user.address, days);
    const stats = await getUserStats(user.address);

    return c.json({
      success: true,
      data: {
        ...stats,
        history: history.closes,
        weeklyGraph: history.weeklyGraph,
      },
    });
  } catch (error) {
    console.error('Error fetching PnL history:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch PnL history',
      },
      500
    );
  }
});

/**
 * GET /analytics/trends
 * Get trending token mentions from feed (last 24h)
 */
analyticsRouter.get('/trends', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);

    // Get posts from last 24 hours with token mentions
    const posts = await prisma.feedPost.findMany({
      where: {
        tokenMention: {
          not: null,
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      select: {
        tokenMention: true,
      },
    });

    // Count mentions by token
    const tokenMentions = posts.reduce(
      (acc, post) => {
        if (post.tokenMention) {
          acc[post.tokenMention] = (acc[post.tokenMention] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    // Sort by mentions and get top tokens
    const trending = Object.entries(tokenMentions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([token, mentions]) => ({
        token,
        mentions,
      }));

    // Get prices for trending tokens
    const tokenAddresses = trending.map((t) => t.token);
    const prices = await getTokenPrices(tokenAddresses);

    const trendsWithPrice = trending.map((trend) => ({
      ...trend,
      price: prices[trend.token] || null,
    }));

    return c.json({
      success: true,
      data: trendsWithPrice,
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch trends',
      },
      500
    );
  }
});

/**
 * GET /analytics/sentiment
 * Get feed sentiment score per token
 */
analyticsRouter.get('/sentiment', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const sentiment = await getFeedSentiment();

    // Normalize sentiment scores
    const sentimentData = Object.entries(sentiment).map(([token, data]) => ({
      token,
      mentions: data.mentions,
      reactions: data.reactions,
      sentimentScore: data.reactions / Math.max(1, data.mentions), // Avg reactions per mention
    }));

    return c.json({
      success: true,
      data: sentimentData,
    });
  } catch (error) {
    console.error('Error calculating sentiment:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to calculate sentiment',
      },
      500
    );
  }
});

export default analyticsRouter;
