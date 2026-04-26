// src/lib/ethereum.ts
import { ethers } from 'ethers';
import { TierLevel } from '@/types/index';

const OBS_CONTRACT_ABI = [
  'function balanceOf(address account) public view returns (uint256)',
];

export class EthereumService {
  private provider: ethers.JsonRpcProvider;
  private obsContract: ethers.Contract;

  constructor(rpcUrl: string, obsContractAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.obsContract = new ethers.Contract(
      obsContractAddress,
      OBS_CONTRACT_ABI,
      this.provider
    );
  }

  /**
   * Get $OBS token balance for a wallet address
   */
  async getObsBalance(address: string): Promise<string> {
    try {
      const balance = await this.obsContract.balanceOf(address);
      return balance.toString();
    } catch (error) {
      console.error('Error fetching OBS balance:', error);
      return '0';
    }
  }

  /**
   * Verify wallet signature
   */
  verifySignature(
    address: string,
    message: string,
    signature: string
  ): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  /**
   * Validate Ethereum address format
   */
  static isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Generate random nonce for signature challenge
   */
  static generateNonce(address: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${address}:${timestamp}:${random}`;
  }
}

/**
 * Calculate user tier based on $OBS balance
 */
export function calculateTier(obsBalance: string): TierLevel {
  const balance = BigInt(obsBalance);
  const tier1Threshold = BigInt(process.env.TIER_1_THRESHOLD || 1e18);
  const tier2Threshold = BigInt(process.env.TIER_2_THRESHOLD || 1e19);
  const tier3Threshold = BigInt(process.env.TIER_3_THRESHOLD || 1e20);
  const tier4Threshold = BigInt(process.env.TIER_4_THRESHOLD || 1e21);

  if (balance >= tier4Threshold) return TierLevel.T4;
  if (balance >= tier3Threshold) return TierLevel.T3;
  if (balance >= tier2Threshold) return TierLevel.T2;
  if (balance >= tier1Threshold) return TierLevel.T1;
  return TierLevel.T0;
}

/**
 * Get tier label/name
 */
export function getTierLabel(tier: TierLevel): string {
  const labels: Record<TierLevel, string> = {
    [TierLevel.T0]: 'Observer',
    [TierLevel.T1]: 'Sentinel',
    [TierLevel.T2]: 'Oracle',
    [TierLevel.T3]: 'Sage',
    [TierLevel.T4]: 'Archon',
  };
  return labels[tier];
}
