import type { Address } from 'viem';

export interface PinataConfig {
  jwt: string;
  gateway?: string;
}

export interface VideoUploadResult {
  ipfsUri: string;
  arweaveUri?: string;
  pinataUrl: string;
}

export interface MintVideoOptions {
  name: string;
  description: string;
  videoUri: string;
  thumbnailUri: string;
  duration: number;
  creator: Address;
  chain?: string;
  tokenId?: bigint;
  editionSize?: number;
  royaltyBps?: number;
  mintPriceWei?: bigint;
  linkedCreatorCoin?: Address;
}

export interface MintResult {
  tokenId: string;
  contractAddress: Address;
  txHash: string;
  explorerUrl: string;
  metadataUri: string;
}

export interface ZoraVideoNFT {
  tokenId: string;
  contractAddress: Address;
  name: string;
  description: string;
  videoUri: string;
  thumbnailUri: string;
  duration: number;
  creator: Address;
  owner: Address;
  editionSize: number;
  royaltyBps: number;
  linkedCreatorCoin?: Address;
  mintPriceWei: string;
  chain: string;
  totalSupply: string;
  createdAt: string;
}

export interface CollectResult {
  txHash: string;
  tokenId: string;
  explorerUrl: string;
  amount: string;
}

export interface TipResult {
  txHash: string;
  explorerUrl: string;
  amount: string;
  coinPurchased: boolean;
}

export interface AnnounceResult {
  activityPub: boolean;
  atProtocol: boolean;
  nostr: boolean;
  farcaster: boolean;
  errors: string[];
}

export interface TrendingQuery {
  limit?: number;
  network?: string;
}

export interface VideoMetadata {
  name: string;
  description: string;
  image: string;
  animation_url: string;
  content?: { url: string; mime_type: string; duration?: string };
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  linked_creator_coin?: Address;
  duration?: number;
}

import type { Account, Chain, HttpTransport, PublicClient, WalletClient } from 'viem';
import type { KVStore } from '../cross-chain/registry';

export interface ZoraVideoSDKConfig {
  pinataJwt: string;
  pinataGateway?: string;
  walletClient?: WalletClient<HttpTransport, Chain, Account>;
  publicClient?: PublicClient<HttpTransport, Chain>;
  defaultChain?: 'base' | 'ethereum' | 'optimism' | 'arbitrum' | 'zora';
  crossChainRegistry?: KVStore;
}
