// src/services/token.service.ts
import axios from 'axios';
import { cacheManager } from '@/lib/redis';
import { retry } from '@/lib/utils';
import type { TokenInfo, TokenPrice } from '@/types/index';

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

/**
 * Get token price from CoinGecko
 */
export async function getTokenPrice(tokenAddress: string): Promise<number | null> {
  // Check cache first
  const cached = await cacheManager.getTokenPrice(tokenAddress);
  if (cached !== null) {
    return cached;
  }

  try {
    const price = await retry(
      async () => {
        const response = await axios.get(
          `${COINGECKO_API_BASE}/simple/token_price/ethereum`,
          {
            params: {
              contract_addresses: tokenAddress,
              vs_currencies: 'usd',
              include_market_cap: false,
              include_24hr_vol: false,
              include_24hr_change: false,
            },
          }
        );

        return response.data[tokenAddress.toLowerCase()]?.usd || null;
      },
      { maxAttempts: 3, delayMs: 500 }
    );

    if (price) {
      // Cache for 60 seconds
      await cacheManager.setTokenPrice(tokenAddress, price);
    }

    return price;
  } catch (error) {
    console.error('Error fetching token price:', error);
    return null;
  }
}

/**
 * Get token info from CoinGecko or fallback
 */
export async function getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
  try {
    const response = await axios.get(
      `${COINGECKO_API_BASE}/coins/ethereum/contract/${tokenAddress}`
    );

    const data = response.data;
    return {
      address: tokenAddress,
      name: data.name || 'Unknown',
      symbol: data.symbol ? data.symbol.toUpperCase() : 'UNKNOWN',
      decimals: data.detail_platforms?.ethereum?.decimal_place || 18,
    };
  } catch (error) {
    console.error('Error fetching token info:', error);
    return null;
  }
}

/**
 * Get multiple token prices
 */
export async function getTokenPrices(
  tokenAddresses: string[]
): Promise<Record<string, number | null>> {
  const prices: Record<string, number | null> = {};

  try {
    const response = await axios.get(
      `${COINGECKO_API_BASE}/simple/token_price/ethereum`,
      {
        params: {
          contract_addresses: tokenAddresses.join(','),
          vs_currencies: 'usd',
        },
      }
    );

    for (const address of tokenAddresses) {
      const price = response.data[address.toLowerCase()]?.usd || null;
      prices[address] = price;

      if (price) {
        await cacheManager.setTokenPrice(address, price);
      }
    }

    return prices;
  } catch (error) {
    console.error('Error fetching token prices:', error);
    return tokenAddresses.reduce((acc, addr) => {
      acc[addr] = null;
      return acc;
    }, {} as Record<string, null>);
  }
}

/**
 * Get trending tokens from feed mentions (last 24h)
 */
export async function getTrendingTokens(limit: number = 10): Promise<string[]> {
  try {
    // This would typically query the FeedPost table for tokenMention field
    // For now, return mock data - implement actual trending logic based on your DB
    return [];
  } catch (error) {
    console.error('Error fetching trending tokens:', error);
    return [];
  }
}

/**
 * Clear token price cache
 */
export async function clearTokenPriceCache(tokenAddress: string): Promise<void> {
  await cacheManager.del(`token:price:${tokenAddress}`);
}
