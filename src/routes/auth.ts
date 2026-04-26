// src/routes/auth.ts
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { EthereumService, calculateTier } from '@/lib/ethereum';
import { signJWT, getJWTExpiryDate, verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { generateNonceSchema, verifySignatureSchema, refreshTokenSchema } from '@/validators/index';
import { getAuthCookieOptions, getJWTCookieName, requireAuthMiddleware } from '@/middleware/auth';
import type { AppContext } from '@/types/index';

const authRouter = new Hono<{ Variables: AppContext }>();

const ethereumService = new EthereumService(
  process.env.ETHEREUM_RPC_URL || '',
  process.env.OBS_CONTRACT_ADDRESS || ''
);

/**
 * POST /auth/nonce
 * Generate random nonce for wallet signature challenge
 */
authRouter.post('/nonce', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = generateNonceSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'Invalid address format',
        },
        400
      );
    }

    const { address } = parsed.data;
    const nonce = EthereumService.generateNonce(address);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save nonce to database
    await prisma.nonce.create({
      data: {
        address,
        nonce,
        expiresAt,
      },
    });

    return c.json({
      success: true,
      data: {
        nonce,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Error generating nonce:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to generate nonce',
      },
      500
    );
  }
});

/**
 * POST /auth/verify
 * Verify wallet signature and issue JWT token
 */
authRouter.post('/verify', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = verifySignatureSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'Invalid request data',
        },
        400
      );
    }

    const { address, nonce, signature } = parsed.data;

    // Verify nonce exists and is not expired
    const nonceRecord = await prisma.nonce.findFirst({
      where: {
        address,
        nonce,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!nonceRecord) {
      return c.json(
        {
          success: false,
          error: 'Invalid or expired nonce',
        },
        401
      );
    }

    // Verify signature
    const isValidSignature = ethereumService.verifySignature(address, nonce, signature);
    if (!isValidSignature) {
      return c.json(
        {
          success: false,
          error: 'Invalid signature',
        },
        401
      );
    }

    // Mark nonce as used
    await prisma.nonce.update({
      where: { id: nonceRecord.id },
      data: { isUsed: true },
    });

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { address },
    });

    if (!user) {
      // Fetch tier on first login
      const obsBalance = await ethereumService.getObsBalance(address);
      const tier = calculateTier(obsBalance);

      user = await prisma.user.create({
        data: {
          address,
          tier,
          obsBalance,
        },
      });
    }

    // Generate JWT
    const token = signJWT(address);
    const expiryDate = getJWTExpiryDate();

    // Set HTTP-only cookie
    setCookie(c, getJWTCookieName(), token, getAuthCookieOptions(expiryDate));

    return c.json({
      success: true,
      data: {
        user: {
          address: user.address,
          username: user.username,
          tier: user.tier,
          avatar: user.avatar,
        },
        token,
        expiresAt: expiryDate,
      },
    });
  } catch (error) {
    console.error('Error verifying signature:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to verify signature',
      },
      500
    );
  }
});

/**
 * POST /auth/refresh
 * Refresh JWT token
 */
authRouter.post('/refresh', async (c: Context<{ Variables: AppContext }>) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = refreshTokenSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'Invalid refresh token',
        },
        400
      );
    }

    const { refreshToken } = parsed.data;

    // Verify refresh token from database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      return c.json(
        {
          success: false,
          error: 'Invalid or expired refresh token',
        },
        401
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { address: storedToken.userAddress },
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

    // Generate new JWT
    const newToken = signJWT(user.address);
    const expiryDate = getJWTExpiryDate();

    // Set HTTP-only cookie
    setCookie(c, getJWTCookieName(), newToken, getAuthCookieOptions(expiryDate));

    return c.json({
      success: true,
      data: {
        token: newToken,
        expiresAt: expiryDate,
      },
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to refresh token',
      },
      500
    );
  }
});

export default authRouter;
