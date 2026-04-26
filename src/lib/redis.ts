// src/lib/redis.ts
import { createClient, type RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<RedisClientType> {
  if (redisClient) return redisClient;

  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  client.on('error', (err) => console.error('Redis error:', err));
  client.on('connect', () => console.log('Redis connected'));

  await client.connect();
  redisClient = client;

  return client;
}

/**
 * Get Redis client
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
}

/**
 * Disconnect Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }
}

/**
 * Cache utilities
 */
export const cacheManager = {
  // Token prices: TTL 60s
  async setTokenPrice(address: string, price: number): Promise<void> {
    const client = getRedisClient();
    await client.setEx(`token:price:${address}`, 60, JSON.stringify(price));
  },

  async getTokenPrice(address: string): Promise<number | null> {
    const client = getRedisClient();
    const cached = await client.get(`token:price:${address}`);
    return cached ? JSON.parse(cached) : null;
  },

  // User tier: TTL 300s (5 min)
  async setUserTier(address: string, tier: number): Promise<void> {
    const client = getRedisClient();
    await client.setEx(`user:tier:${address}`, 300, tier.toString());
  },

  async getUserTier(address: string): Promise<number | null> {
    const client = getRedisClient();
    const cached = await client.get(`user:tier:${address}`);
    return cached ? parseInt(cached, 10) : null;
  },

  // Feed pagination cursors: TTL 30s
  async setFeedCursor(userId: string, cursor: string): Promise<void> {
    const client = getRedisClient();
    await client.setEx(`feed:cursor:${userId}`, 30, cursor);
  },

  async getFeedCursor(userId: string): Promise<string | null> {
    const client = getRedisClient();
    return await client.get(`feed:cursor:${userId}`);
  },

  // Rate limit counters: TTL 60s
  async incrementRateLimit(key: string): Promise<number> {
    const client = getRedisClient();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, 60);
    }
    return count;
  },

  async getRateLimitCount(key: string): Promise<number> {
    const client = getRedisClient();
    const count = await client.get(key);
    return count ? parseInt(count, 10) : 0;
  },

  async resetRateLimit(key: string): Promise<void> {
    const client = getRedisClient();
    await client.del(key);
  },

  // Generic cache operations
  async set(key: string, value: any, ttlSecs: number = 3600): Promise<void> {
    const client = getRedisClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await client.setEx(key, ttlSecs, serialized);
  },

  async get(key: string): Promise<any | null> {
    const client = getRedisClient();
    const value = await client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },

  async del(key: string): Promise<void> {
    const client = getRedisClient();
    await client.del(key);
  },

  async clear(): Promise<void> {
    const client = getRedisClient();
    await client.flushDb();
  },
};
