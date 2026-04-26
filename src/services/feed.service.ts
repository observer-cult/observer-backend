// src/services/feed.service.ts
import { prisma } from '@/lib/prisma';
import { ReactionType } from '@/types/index';

/**
 * Create a feed post
 */
export async function createPost(
  userAddress: string,
  content: string,
  tier: number,
  tokenMention?: string
) {
  try {
    return await prisma.feedPost.create({
      data: {
        userAddress,
        content,
        tier,
        tokenMention,
      },
      include: {
        author: {
          select: {
            address: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
}

/**
 * Get paginated feed filtered by user tier
 */
export async function getFeed(
  userTier: number,
  cursor?: string,
  take: number = 20
) {
  try {
    const where = {
      tier: {
        lte: userTier,
      },
    };

    const posts = await prisma.feedPost.findMany({
      where,
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor
        ? {
            id: cursor,
          }
        : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        author: {
          select: {
            address: true,
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            reactions: true,
            comments: true,
          },
        },
      },
    });

    return {
      items: posts.map((post) => ({
        ...post,
        reactionCount: post._count.reactions,
        commentCount: post._count.comments,
      })),
      nextCursor: posts.length === take ? posts[posts.length - 1].id : null,
    };
  } catch (error) {
    console.error('Error fetching feed:', error);
    throw error;
  }
}

/**
 * Add reaction to post
 */
export async function addReaction(
  postId: string,
  userAddress: string,
  reactionType: string
) {
  try {
    // Validate reaction type
    if (!Object.values(ReactionType).includes(reactionType)) {
      throw new Error('Invalid reaction type');
    }

    return await prisma.feedReaction.upsert({
      where: {
        postId_userAddress_reactionType: {
          postId,
          userAddress,
          reactionType,
        },
      },
      update: {
        reactionType,
      },
      create: {
        postId,
        userAddress,
        reactionType,
      },
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    throw error;
  }
}

/**
 * Remove reaction from post
 */
export async function removeReaction(
  postId: string,
  userAddress: string,
  reactionType: string
) {
  try {
    return await prisma.feedReaction.delete({
      where: {
        postId_userAddress_reactionType: {
          postId,
          userAddress,
          reactionType,
        },
      },
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    throw error;
  }
}

/**
 * Add comment to post
 */
export async function addComment(
  postId: string,
  userAddress: string,
  content: string
) {
  try {
    return await prisma.feedComment.create({
      data: {
        postId,
        userAddress,
        content,
      },
      include: {
        user: {
          select: {
            address: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
}

/**
 * Get post comments
 */
export async function getPostComments(postId: string, take: number = 20) {
  try {
    return await prisma.feedComment.findMany({
      where: { postId },
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            address: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
}

/**
 * Delete post (only if owner or admin)
 */
export async function deletePost(postId: string, requesterAddress: string) {
  try {
    const post = await prisma.feedPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    if (post.userAddress !== requesterAddress) {
      throw new Error('Not authorized to delete this post');
    }

    // Delete reactions and comments first (foreign key constraints)
    await prisma.feedReaction.deleteMany({
      where: { postId },
    });

    await prisma.feedComment.deleteMany({
      where: { postId },
    });

    return await prisma.feedPost.delete({
      where: { id: postId },
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
}

/**
 * Get feed sentiment by token
 */
export async function getFeedSentiment(tokenAddress: string | undefined = undefined) {
  try {
    const where = tokenAddress
      ? { tokenMention: tokenAddress }
      : { tokenMention: { not: null } };

    const posts = await prisma.feedPost.findMany({
      where,
      select: {
        id: true,
        tokenMention: true,
        _count: {
          select: {
            reactions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    // Group by token and calculate sentiment
    const sentiment = posts.reduce(
      (acc, post) => {
        if (!post.tokenMention) return acc;

        if (!acc[post.tokenMention]) {
          acc[post.tokenMention] = { mentions: 0, reactions: 0 };
        }

        acc[post.tokenMention].mentions++;
        acc[post.tokenMention].reactions += post._count.reactions;

        return acc;
      },
      {} as Record<string, { mentions: number; reactions: number }>
    );

    return sentiment;
  } catch (error) {
    console.error('Error calculating sentiment:', error);
    throw error;
  }
}
