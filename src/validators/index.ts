// src/validators/index.ts
import { z } from 'zod';

// Auth validators
export const generateNonceSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

export const verifySignatureSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  nonce: z.string().min(10, 'Invalid nonce'),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/, 'Invalid signature'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Invalid refresh token'),
});

// User validators
export const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
});

// Cult validators
export const createCultSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  minTier: z.number().int().min(0).max(4),
});

// Feed validators
export const createFeedPostSchema = z.object({
  content: z.string().min(1).max(1000),
  tier: z.number().int().min(0).max(4).default(0),
  tokenMention: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

export const reactToPostSchema = z.object({
  reactionType: z.enum(['like', 'fire', 'eye']),
});

export const commentOnPostSchema = z.object({
  content: z.string().min(1).max(500),
});

// Transmission validators
export const createTransmissionSchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  chain: z.string().min(1).max(50),
  entryPrice: z.string().regex(/^\d+$/, 'Entry price must be a positive integer'),
  targetPrice: z.string().regex(/^\d+$/, 'Target price must be a positive integer'),
});

export const closeTransmissionSchema = z.object({
  exitPrice: z.string().regex(/^\d+$/, 'Exit price must be a positive integer'),
});

// Pagination validators
export const paginationSchema = z.object({
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// Query validators
export const tierFilterSchema = z.object({
  minTier: z.number().int().min(0).max(4).optional(),
});
