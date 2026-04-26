// src/services/cult.service.ts
import { prisma } from '@/lib/prisma';

/**
 * Create a new cult
 */
export async function createCult(
  name: string,
  description: string | undefined,
  minTier: number,
  creatorAddress: string
) {
  try {
    const cult = await prisma.cult.create({
      data: {
        name,
        description,
        minTier,
        creatorAddress,
      },
    });

    // Add creator as member
    await prisma.cultMember.create({
      data: {
        cultId: cult.id,
        userAddress: creatorAddress,
      },
    });

    return cult;
  } catch (error) {
    console.error('Error creating cult:', error);
    throw error;
  }
}

/**
 * Get cult by ID with details
 */
export async function getCultDetail(cultId: string) {
  try {
    const cult = await prisma.cult.findUnique({
      where: { id: cultId },
      include: {
        creator: {
          select: {
            address: true,
            username: true,
            avatar: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                address: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        transmissions: {
          take: 10,
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
        },
      },
    });

    if (!cult) return null;

    return {
      ...cult,
      memberCount: cult.members.length,
      recentTransmissions: cult.transmissions,
    };
  } catch (error) {
    console.error('Error fetching cult detail:', error);
    throw error;
  }
}

/**
 * List all cults
 */
export async function listCults(skip: number = 0, take: number = 20) {
  try {
    const cults = await prisma.cult.findMany({
      skip,
      take,
      include: {
        _count: {
          select: { members: true },
        },
        transmissions: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return cults.map((cult) => ({
      ...cult,
      memberCount: cult._count.members,
      recentTransmissionCount: cult.transmissions.length,
    }));
  } catch (error) {
    console.error('Error listing cults:', error);
    throw error;
  }
}

/**
 * Check if user meets tier requirement
 */
export async function checkTierRequirement(
  userTier: number,
  cult: Awaited<ReturnType<typeof getCultDetail>>
): Promise<boolean> {
  if (!cult) return false;
  return userTier >= cult.minTier;
}

/**
 * Check if user is member of cult
 */
export async function isCultMember(cultId: string, userAddress: string): Promise<boolean> {
  try {
    const member = await prisma.cultMember.findUnique({
      where: {
        cultId_userAddress: {
          cultId,
          userAddress,
        },
      },
    });

    return !!member;
  } catch (error) {
    console.error('Error checking cult membership:', error);
    return false;
  }
}

/**
 * Join cult
 */
export async function joinCult(cultId: string, userAddress: string) {
  try {
    // Check if cult exists
    const cult = await prisma.cult.findUnique({
      where: { id: cultId },
    });

    if (!cult) {
      throw new Error('Cult not found');
    }

    // Check if already member
    const existing = await isCultMember(cultId, userAddress);
    if (existing) {
      throw new Error('Already a member of this cult');
    }

    // Add member
    return await prisma.cultMember.create({
      data: {
        cultId,
        userAddress,
      },
    });
  } catch (error) {
    console.error('Error joining cult:', error);
    throw error;
  }
}

/**
 * Leave cult
 */
export async function leaveCult(cultId: string, userAddress: string) {
  try {
    // Check if member
    const isMember = await isCultMember(cultId, userAddress);
    if (!isMember) {
      throw new Error('Not a member of this cult');
    }

    // Check if creator (creator cannot leave)
    const cult = await prisma.cult.findUnique({
      where: { id: cultId },
    });

    if (cult?.creatorAddress === userAddress) {
      throw new Error('Cult creator cannot leave');
    }

    return await prisma.cultMember.delete({
      where: {
        cultId_userAddress: {
          cultId,
          userAddress,
        },
      },
    });
  } catch (error) {
    console.error('Error leaving cult:', error);
    throw error;
  }
}

/**
 * Get user's cults
 */
export async function getUserCults(userAddress: string) {
  try {
    return await prisma.cultMember.findMany({
      where: { userAddress },
      include: {
        cult: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });
  } catch (error) {
    console.error('Error fetching user cults:', error);
    throw error;
  }
}
