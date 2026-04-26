// src/middleware/auth.ts
import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import type { AppContext } from '@/types/index';

const JWT_COOKIE_NAME = 'auth_token';

/**
 * Auth middleware - validates JWT from cookie
 */
export async function authMiddleware(
  c: Context<{ Variables: AppContext }>,
  next: Next
) {
  const token = getCookie(c, JWT_COOKIE_NAME);

  if (!token) {
    c.set('user', undefined);
    return next();
  }

  const decoded = verifyJWT(token);
  if (!decoded) {
    c.set('user', undefined);
    return next();
  }

  try {
    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { address: decoded.address },
    });

    if (!user) {
      c.set('user', undefined);
      return next();
    }

    c.set('user', user);
  } catch (error) {
    console.error('Auth middleware error:', error);
    c.set('user', undefined);
  }

  return next();
}

/**
 * Require auth middleware - returns 401 if user not authenticated
 */
export async function requireAuthMiddleware(
  c: Context<{ Variables: AppContext }>,
  next: Next
) {
  const user = c.get('user');

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  return next();
}

export function getJWTCookieName(): string {
  return JWT_COOKIE_NAME;
}

/**
 * Get auth token cookie options
 */
export function getAuthCookieOptions(expiryDate: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict' as const,
    expires: expiryDate,
    path: '/',
  };
}
