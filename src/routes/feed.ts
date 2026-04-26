// src/routes/feed.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import { prisma } from '@/lib/prisma';
import {
  createFeedPostSchema,
  reactToPostSchema,
  commentOnPostSchema,
} from '@/validators/index';
import { requireAuthMiddleware } from '@/middleware/auth';
import {
  createPost,
  getFeed,
  addReaction,
  removeReaction,
  addComment,
  getPostComments,
  deletePost,
} from '@/services/feed.service';
import { sanitizeString } from '@/lib/utils';
import type { AppContext } from '@/types/index';

const feedRouter = new Hono<{ Variables: AppContext }>();

/**
 * GET /feed
 * Get paginated feed filtered by user tier
 */
feedRouter.get('/', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const user = c.get('user');
    const userTier = user?.tier || 0;

    const cursor = c.req.query('cursor');
    const take = Math.min(parseInt(c.req.query('take') || '20', 10), 100);

    const result = await getFeed(userTier, cursor, take);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching feed:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch feed',
      },
      500
    );
  }
});

/**
 * POST /feed
 * Create a feed post
 */
feedRouter.post('/', requireAuthMiddleware, async (c: Context<{ Variables: AppContext }>) => {
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
    const parsed = createFeedPostSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'Invalid request data',
        },
        400
      );
    }

    const { content, tier = 0, tokenMention } = parsed.data;

    const post = await createPost(
      user.address,
      sanitizeString(content),
      tier,
      tokenMention
    );

    return c.json(
      {
        success: true,
        data: post,
      },
      201
    );
  } catch (error) {
    console.error('Error creating post:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to create post',
      },
      500
    );
  }
});

/**
 * POST /feed/:id/react
 * React to a post
 */
feedRouter.post(
  '/:id/react',
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
      const parsed = reactToPostSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: 'Invalid reaction type',
          },
          400
        );
      }

      const { reactionType } = parsed.data;

      // Check if post exists
      const post = await prisma.feedPost.findUnique({
        where: { id },
      });

      if (!post) {
        return c.json(
          {
            success: false,
            error: 'Post not found',
          },
          404
        );
      }

      await addReaction(id, user.address, reactionType);

      return c.json({
        success: true,
        data: {
          message: 'Reaction added',
        },
      });
    } catch (error) {
      console.error('Error adding reaction:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to add reaction',
        },
        500
      );
    }
  }
);

/**
 * POST /feed/:id/comment
 * Comment on a post
 */
feedRouter.post(
  '/:id/comment',
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

      // Check if post exists
      const post = await prisma.feedPost.findUnique({
        where: { id },
      });

      if (!post) {
        return c.json(
          {
            success: false,
            error: 'Post not found',
          },
          404
        );
      }

      const body = await c.req.json().catch(() => ({}));
      const parsed = commentOnPostSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: 'Invalid request data',
          },
          400
        );
      }

      const { content } = parsed.data;

      const comment = await addComment(id, user.address, sanitizeString(content));

      return c.json(
        {
          success: true,
          data: comment,
        },
        201
      );
    } catch (error) {
      console.error('Error adding comment:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to add comment',
        },
        500
      );
    }
  }
);

/**
 * DELETE /feed/:id
 * Delete own post
 */
feedRouter.delete('/:id', requireAuthMiddleware, async (c: Context<{ Variables: AppContext }>) => {
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

    await deletePost(id, user.address);

    return c.json({
      success: true,
      data: {
        message: 'Post deleted',
      },
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete post';

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
});

export default feedRouter;
