// src/lib/utils.ts
import { z } from 'zod';

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Normalize address (lowercase)
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Format address for display (abbreviated)
 */
export function formatAddressShort(address: string): string {
  if (!isValidAddress(address)) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format large numbers as readable strings
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return parseFloat(num.toFixed(decimals)).toLocaleString();
}

/**
 * Convert wei to readable format
 */
export function formatWei(wei: string, decimals: number = 18): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const value = BigInt(wei) / divisor;
  return value.toString();
}

/**
 * Calculate percentage change
 */
export function calculatePnL(
  entryPrice: string,
  currentPrice: string
): { pnlPercent: number; isWin: boolean } {
  const entry = parseFloat(entryPrice);
  const current = parseFloat(currentPrice);

  if (entry === 0) return { pnlPercent: 0, isWin: false };

  const pnlPercent = ((current - entry) / entry) * 100;
  const isWin = pnlPercent > 0;

  return { pnlPercent, isWin };
}

/**
 * Generate pagination cursor
 */
export function generateCursor(id: string, timestamp: number): string {
  return Buffer.from(`${id}:${timestamp}`).toString('base64');
}

/**
 * Decode pagination cursor
 */
export function decodeCursor(cursor: string): { id: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [id, timestamp] = decoded.split(':');
    return { id, timestamp: parseInt(timestamp, 10) };
  } catch {
    return null;
  }
}

/**
 * Check if address is in tier capacity
 */
export function isTierSufficient(userTier: number, requiredTier: number): boolean {
  return userTier >= requiredTier;
}

/**
 * Sanitize string input (prevent XSS)
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/[<>\"'&]/g, (match) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return escapeMap[match] || match;
    })
    .trim();
}

/**
 * Create error response
 */
export function createErrorResponse(message: string, statusCode: number = 400) {
  return {
    success: false,
    error: message,
    statusCode,
  };
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(data: T, message?: string) {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * Validation schemas
 */
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const nonceSchema = z.string().min(10);
export const signatureSchema = z.string().regex(/^0x[a-fA-F0-9]{130}$/);
export const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

/**
 * Retry utility
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000 } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw new Error('Retry max attempts exceeded');
}

/**
 * Debounce async function
 */
export function debounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: NodeJS.Timeout | null = null;

  return async (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        fn(...args).then(resolve).catch(reject);
      }, delayMs);
    });
  };
}

/**
 * Cache utility with TTL
 */
export class CacheEntry<T> {
  value: T;
  expiresAt: number;

  constructor(value: T, ttlMs: number) {
    this.value = value;
    this.expiresAt = Date.now() + ttlMs;
  }

  isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }
}
