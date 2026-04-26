// src/services/tier.service.ts
import { EthereumService, calculateTier, getTierLabel } from '@/lib/ethereum';
import { cacheManager } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

const ethereumService = new EthereumService(
  process.env.ETHEREUM_RPC_URL || '',
  process.env.OBS_CONTRACT_ADDRESS || ''
);

/**
 * Get user's current tier (with caching)
 */
export async function getUserTier(address: string): Promise<{ tier: number; label: string }> {
  // Check cache first
  const cachedTier = await cacheManager.getUserTier(address);
  if (cachedTier !== null) {
    return {
      tier: cachedTier,
      label: getTierLabel(cachedTier),
    };
  }

  try {
    // Fetch balance from blockchain
    const obsBalance = await ethereumService.getObsBalance(address);

    // Calculate tier
    const tier = calculateTier(obsBalance);

    // Update cache and database
    await cacheManager.setUserTier(address, tier);
    await prisma.user.update(
      {
        where: { address },
        data: { tier, obsBalance },
      }
    ).catch(() => {
      // User might not exist, no-op
    });

    return {
      tier,
      label: getTierLabel(tier),
    };
  } catch (error) {
    console.error('Error fetching user tier:', error);

    // Fall back to database value
    const user = await prisma.user.findUnique({
      where: { address },
      select: { tier: true },
    });

    const tier = user?.tier ?? 0;
    return {
      tier,
      label: getTierLabel(tier),
    };
  }
}

/**
 * Get user's token balance
 */
export async function getUserTokenBalance(address: string): Promise<string> {
  try {
    const balance = await ethereumService.getObsBalance(address);
    return balance;
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return '0';
  }
}

/**
 * Refresh all user tier data
 */
export async function refreshUserTierData(address: string): Promise<void> {
  try {
    const obsBalance = await ethereumService.getObsBalance(address);
    const tier = calculateTier(obsBalance);

    await prisma.user.update({
      where: { address },
      data: { tier, obsBalance },
    });

    // Update cache
    await cacheManager.setUserTier(address, tier);
  } catch (error) {
    console.error('Error refreshing user tier data:', error);
  }
}

/**
 * Get tier information
 */
export function getTierInfo(tier: number) {
  const tiers = [
    {
      tier: 0,
      label: 'Observer',
      minBalance: '0',
      features: ['View public feed'],
    },
    {
      tier: 1,
      label: 'Sentinel',
      minBalance: process.env.TIER_1_THRESHOLD || '1000000000000000000',
      features: ['Post content', 'React to posts'],
    },
    {
      tier: 2,
      label: 'Oracle',
      minBalance: process.env.TIER_2_THRESHOLD || '10000000000000000000',
      features: ['Create transmissions', 'Join cults'],
    },
    {
      tier: 3,
      label: 'Sage',
      minBalance: process.env.TIER_3_THRESHOLD || '100000000000000000000',
      features: ['Create cults', 'Advanced analytics'],
    },
    {
      tier: 4,
      label: 'Archon',
      minBalance: process.env.TIER_4_THRESHOLD || '1000000000000000000000',
      features: ['All features', 'Priority access'],
    },
  ];

  return tiers.find((t) => t.tier === tier) || tiers[0];
}
