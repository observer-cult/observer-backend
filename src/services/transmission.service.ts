// src/services/transmission.service.ts
import { prisma } from '@/lib/prisma';
import { getTokenPrice } from './token.service';
import { calculatePnL } from '@/lib/utils';

/**
 * Create a transmission
 */
export async function createTransmission(
  userAddress: string,
  tokenAddress: string,
  chain: string,
  entryPrice: string,
  targetPrice: string,
  cultId?: string
) {
  try {
    return await prisma.transmission.create({
      data: {
        userAddress,
        tokenAddress,
        chain,
        entryPrice,
        targetPrice,
        cultId,
      },
      include: {
        creator: {
          select: {
            address: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error creating transmission:', error);
    throw error;
  }
}

/**
 * Get transmission with current PnL
 */
export async function getTransmissionWithPnL(transmissionId: string) {
  try {
    const transmission = await prisma.transmission.findUnique({
      where: { id: transmissionId },
      include: {
        creator: {
          select: {
            address: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    if (!transmission) return null;

    // If closed, return stored PnL
    if (transmission.closedAt) {
      return {
        ...transmission,
        status: 'closed',
      };
    }

    // If open, calculate current PnL
    try {
      const currentPrice = await getTokenPrice(transmission.tokenAddress);
      if (currentPrice) {
        const { pnlPercent, isWin } = calculatePnL(
          transmission.entryPrice,
          currentPrice.toString()
        );

        return {
          ...transmission,
          currentPrice: currentPrice.toString(),
          pnlPercent,
          isWin,
          status: 'open',
        };
      }
    } catch (error) {
      console.error('Error calculating current PnL:', error);
    }

    return {
      ...transmission,
      status: 'open',
    };
  } catch (error) {
    console.error('Error fetching transmission:', error);
    throw error;
  }
}

/**
 * Get all public transmissions
 */
export async function getAllTransmissions(skip: number = 0, take: number = 20) {
  try {
    const transmissions = await prisma.transmission.findMany({
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        creator: {
          select: {
            address: true,
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            closes: true,
          },
        },
      },
    });

    // Fetch current prices for open transmissions
    const enhanced = await Promise.all(
      transmissions.map(async (transmission) => {
        if (transmission.closedAt) {
          return {
            ...transmission,
            status: 'closed',
          };
        }

        try {
          const currentPrice = await getTokenPrice(transmission.tokenAddress);
          if (currentPrice) {
            const { pnlPercent, isWin } = calculatePnL(
              transmission.entryPrice,
              currentPrice.toString()
            );

            return {
              ...transmission,
              currentPrice: currentPrice.toString(),
              pnlPercent,
              isWin,
              status: 'open',
            };
          }
        } catch {
          // Continue without current price
        }

        return {
          ...transmission,
          status: 'open',
        };
      })
    );

    return enhanced;
  } catch (error) {
    console.error('Error fetching transmissions:', error);
    throw error;
  }
}

/**
 * Get user's transmissions
 */
export async function getUserTransmissions(userAddress: string) {
  try {
    return await prisma.transmission.findMany({
      where: { userAddress },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            closes: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching user transmissions:', error);
    throw error;
  }
}

/**
 * Get cult transmissions
 */
export async function getCultTransmissions(cultId: string, take: number = 20) {
  try {
    return await prisma.transmission.findMany({
      where: { cultId },
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        creator: {
          select: {
            address: true,
            username: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching cult transmissions:', error);
    throw error;
  }
}

/**
 * Close transmission
 */
export async function closeTransmissionAndRecord(
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

    if (transmission.closedAt) {
      throw new Error('Transmission is already closed');
    }

    const { pnlPercent, isWin } = calculatePnL(transmission.entryPrice, exitPrice);

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
 * Post transmission inside cult
 */
export async function postCultTransmission(
  cultId: string,
  userAddress: string,
  tokenAddress: string,
  chain: string,
  entryPrice: string,
  targetPrice: string
) {
  try {
    // Verify user is cult member
    const member = await prisma.cultMember.findUnique({
      where: {
        cultId_userAddress: {
          cultId,
          userAddress,
        },
      },
    });

    if (!member) {
      throw new Error('Not a member of this cult');
    }

    return await createTransmission(
      userAddress,
      tokenAddress,
      chain,
      entryPrice,
      targetPrice,
      cultId
    );
  } catch (error) {
    console.error('Error posting cult transmission:', error);
    throw error;
  }
}
