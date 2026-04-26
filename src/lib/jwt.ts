// src/lib/jwt.ts
import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@/types/index';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '30d';

/**
 * Sign JWT token
 */
export function signJWT(address: string): string {
  const payload: JWTPayload = {
    address,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + getExpiryInSeconds(JWT_EXPIRY),
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

/**
 * Verify JWT token
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('Error verifying JWT:', error);
    return null;
  }
}

/**
 * Decode JWT token without verification
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload | null;
    return decoded;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(): string {
  return jwt.sign(
    { type: 'refresh', iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: REFRESH_TOKEN_EXPIRY,
    }
  );
}

/**
 * Convert expiry string to seconds
 * Examples: "7d" -> 604800, "24h" -> 86400, "60m" -> 3600
 */
function getExpiryInSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return 604800; // Default 7 days

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  const units: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };

  return num * (units[unit] || 1);
}

/**
 * Get JWT expiry as Date
 */
export function getJWTExpiryDate(): Date {
  const expirySeconds = getExpiryInSeconds(JWT_EXPIRY);
  return new Date(Date.now() + expirySeconds * 1000);
}

/**
 * Get refresh token expiry as Date
 */
export function getRefreshTokenExpiryDate(): Date {
  const expirySeconds = getExpiryInSeconds(REFRESH_TOKEN_EXPIRY);
  return new Date(Date.now() + expirySeconds * 1000);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: JWTPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  return token.exp < now;
}
