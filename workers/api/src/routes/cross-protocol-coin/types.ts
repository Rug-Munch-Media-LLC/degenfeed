/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Types
 */

export const COIN_PREFIX = 'coin:';
export const SYMBOL_INDEX_PREFIX = 'coin:symbol:';
export const TTL_1Y = 60 * 60 * 24 * 365;

export const BASE_CHAIN_ID = 8453;
export const SOLANA_CHAIN_ID = 901;

export const VALID_PROTOCOLS = new Set([
  'farcaster',
  'nostr',
  'bluesky',
  'threads',
  'lens',
  'mastodon',
  'activitypub',
]);

export interface CrossProtocolCoinRecord {
  symbol: string;
  name: string;
  coinAddress: string;
  tokenId: string;
  chain: string;
  chainId: number;
  originProtocol: string;
  originCreatorId: string;
  deployedAt: number;
  deployedBy: string;
  metadataUri: string;
  zoraUrl: string;
  degenfeedUrl: string;
  announcements?: Record<string, unknown>[];
  totalSupply: string;
  price: string;
  supporters: number;
  totalTips: number;
  totalTipsUsd: number;
}

export interface LaunchCoinBody {
  name?: string;
  symbol?: string;
  chain?: 'base' | 'base_sepolia' | 'solana' | 'solana_devnet';
  originProtocol?: string;
  vestingConfig?: {
    vestingDurationDays?: number;
    creatorAllocationBps?: number;
    cliffDays?: number;
  };
  feeConfig?: {
    creatorFeeBps?: number;
    platformFeeBps?: number;
  };
}

export interface VestingConfig {
  vestingDurationDays: number;
  creatorAllocationBps: number;
  cliffDays: number;
}

export interface FeeConfig {
  creatorFeeBps: number;
  platformFeeBps: number;
}

export type CoinChain = 'base' | 'base_sepolia' | 'solana' | 'solana_devnet';

export interface DeployResult {
  coinAddress: string;
  tokenId: string;
}
