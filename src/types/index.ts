// src/types/index.ts
import type { HonoRequest } from 'hono';
import type { User } from '@prisma/client';

export interface AuthUser extends User {}

export interface AppContext {
  user?: AuthUser;
  req: HonoRequest;
}

export enum ReactionType {
  LIKE = 'like',
  FIRE = 'fire',
  EYE = 'eye',
}

export enum TierLevel {
  T0 = 0,
  T1 = 1,
  T2 = 2,
  T3 = 3,
  T4 = 4,
}

export interface JWTPayload {
  address: string;
  iat: number;
  exp: number;
}

export interface PNLData {
  transmitted_id: string;
  entry_price: string;
  current_price: string;
  pnl_percent: number;
  is_win: boolean;
  token_address: string;
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface TokenPrice {
  address: string;
  price: number;
  currency: string;
  timestamp: number;
}

export interface FeedItem {
  id: string;
  author: string;
  content: string;
  tier: number;
  tokenMention?: string;
  reactionCount: number;
  commentCount: number;
  createdAt: Date;
}

export interface CultDetail {
  id: string;
  name: string;
  description?: string;
  minTier: number;
  creatorAddress: string;
  memberCount: number;
  recentTransmissions: any[];
  createdAt: Date;
}

export interface TransmissionDetail {
  id: string;
  userAddress: string;
  tokenAddress: string;
  chain: string;
  entryPrice: string;
  targetPrice: string;
  currentPrice?: string;
  pnlPercent?: number;
  isWin?: boolean;
  Status: 'open' | 'closed';
  createdAt: Date;
  closedAt?: Date;
}

export interface LeaderboardEntry {
  userAddress: string;
  username?: string;
  winRate: number;
  totalCalls: number;
  totalPNL: number;
  rank: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
