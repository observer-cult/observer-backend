// src/index.ts
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { authMiddleware, requireAuthMiddleware } from '@/middleware/auth';
import { rateLimitMiddleware } from '@/middleware/rateLimit';
import { initRedis, disconnectRedis } from '@/lib/redis';
import { disconnectPrisma } from '@/lib/prisma';

import authRouter from '@/routes/auth';
import usersRouter from '@/routes/users';
import cultsRouter from '@/routes/cults';
import feedRouter from '@/routes/feed';
import transmissionsRouter from '@/routes/transmissions';
import analyticsRouter from '@/routes/analytics';
import tokensRouter from '@/routes/tokens';

import type { AppContext } from '@/types/index';

/**
 * Main application
 */
const app = new Hono<{ Variables: AppContext }>();

// Global middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  })
);

// Auth middleware (applies to all routes)
app.use('*', authMiddleware);

// Rate limiting
app.use('*', rateLimitMiddleware);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
const api = new Hono<{ Variables: AppContext }>();

api.route('/auth', authRouter);
api.route('/users', usersRouter);
api.route('/cults', cultsRouter);
api.route('/feed', feedRouter);
api.route('/transmissions', transmissionsRouter);
api.route('/analytics', analyticsRouter);
api.route('/tokens', tokensRouter);

// Mount API routes
app.route('/api', api);

// Error handling - 404
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Route not found',
    },
    404
  );
});

/**
 * Start server
 */
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  try {
    // Initialize Redis
    await initRedis();
    console.log('✓ Redis connected');

    // Start HTTP server
    console.log(`🚀 Server starting on port ${PORT}...`);
    serve(
      {
        fetch: app.fetch,
        port: PORT,
      },
      (info) => {
        console.log(`✓ Server running at http://localhost:${info.port}`);
      }
    );
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`);

  try {
    await disconnectRedis();
    console.log('✓ Redis disconnected');

    await disconnectPrisma();
    console.log('✓ Prisma disconnected');

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the application
startServer().catch(console.error);
