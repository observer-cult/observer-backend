// src/services/pnl.service.ts
import { prisma } from '@/lib/prisma';
import { calculatePnL } from '@/lib/utils';
import { getTokenPrice } from './token.service';
import type { LeaderboardEntry } from '@/types/index';

/**
 * Calculate PnL for a transmission
 */
export async function calculateTransmissionPnL(
  tokenAddress: string,
  entryPrice: string,
  targetPrice: string
) {
  try {
    const currentPrice = await getTokenPrice(tokenAddress);
    if (!currentPrice) {
      return {
        pnlPercent: 0,
        isWin: false,
        currentPrice: entryPrice,
      };
    }

    const { pnlPercent, isWin } = calculatePnL(entryPrice, currentPrice.toString());

    return {
      pnlPercent,
      isWin,
      currentPrice: currentPrice.toString(),
    };
  } catch (error) {
    console.error('Error calculating PnL:', error);
    return {
      pnlPercent: 0,
      isWin: false,
      currentPrice: entryPrice,
    };
  }
}

/**
 * Close a transmission and record final PnL
 */
export async function closeTransmission(
  transmissionId: string,
  exitPrice: string,
  userAddress: string
) {
  try {
    const transmission = await prisma.transmission.findUnique({
      where: { id: transmissionId },
    });

    if (!transmission) {
      throw new Error('Transmission not found');
    }

    if (transmission.userAddress !== userAddress) {
      throw new Error('Not authorized to close this transmission');
    }

    const { pnlPercent, isWin } = calculatePnL(
      transmission.entryPrice,
      exitPrice
    );

    // Update transmission
    const updated = await prisma.transmission.update({
      where: { id: transmissionId },
      data: {
        exitPrice,
        pnlPercent,
        isWin,
        closedAt: new Date(),
      },
    });

    // Record close event
    await prisma.transmissionClose.create({
      data: {
        transmissionId,
        userAddress,
        exitPrice,
        pnlPercent,
        isWin,
      },
    });

    return updated;
  } catch (error) {
    console.error('Error closing transmission:', error);
    throw error;
  }
}

/**
 * Get user's PnL history
 */
export async function getUserPnLHistory(userAddress: string, days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const closes = await prisma.transmissionClose.findMany({
      where: {
        userAddress,
        closedAt: {
          gte: startDate,
        },
      },
      orderBy: {
        closedAt: 'desc',
      },
      include: {
        transmission: true,
      },
    });

    // Group by week
    const weeklyData = closes.reduce(
      (acc, close) => {
        const week = Math.floor(
          (Date.now() - close.closedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        if (!acc[week]) {
          acc[week] = { totalPnL: 0, wins: 0, losses: 0, count: 0 };
        }
        acc[week].totalPnL += close.pnlPercent;
        if (close.isWin) acc[week].wins++;
        else acc[week].losses++;
        acc[week].count++;
        return acc;
      },
      {} as Record<number, any>
    );

    return {
      closes,
      weeklyGraph: weeklyData,
    };
  } catch (error) {
    console.error('Error fetching PnL history:', error);
    throw error;
  }
}

/**
 * Get leaderboard (ranked by win rate, min 10 closes)
 */
export async function getLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
  try {
    const users = await prisma.user.findMany({
      include: {
        transmissionCloses: {
          where: {
            closedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        },
      },
    });

    const leaderboard = users
      .map((user) => {
        const closes = user.transmissionCloses;
        const totalCalls = closes.length;
        const wins = closes.filter((c) => c.isWin).length;
        const winRate = totalCalls > 0 ? (wins / totalCalls) * 100 : 0;
        const totalPnL = closes.reduce((sum, c) => sum + c.pnlPercent, 0);

        return {
          userAddress: user.address,
          username: user.username,
          winRate,
          totalCalls,
          totalPnL,
          rank: 0,
        };
      })
      .filter((entry) => entry.totalCalls >= 10) // Min 10 closes to qualify
      .sort((a, b) => b.winRate - a.winRate)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))
      .slice(0, limit);

    return leaderboard;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
}

/**
 * Get user stats for dashboard
 */
export async function getUserStats(userAddress: string) {
  try {
    const closes = await prisma.transmissionClose.findMany({
      where: { userAddress },
    });

    const totalCalls = closes.length;
    const wins = closes.filter((c) => c.isWin).length;
    const losses = closes.filter((c) => !c.isWin).length;
    const winRate = totalCalls > 0 ? (wins / totalCalls) * 100 : 0;
    const totalPnL = closes.reduce((sum, c) => sum + c.pnlPercent, 0);
    const avgPnL = totalCalls > 0 ? totalPnL / totalCalls : 0;

    return {
      totalCalls,
      wins,
      losses,
      winRate,
      totalPnL,
      avgPnL,
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    throw error;
  }
}
