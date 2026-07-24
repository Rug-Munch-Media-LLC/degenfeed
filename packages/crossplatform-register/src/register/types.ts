import type { UnifiedIdentity } from '@degenfeed/types';

export type RegistrationPlatform = 'farcaster' | 'lens' | 'bluesky' | 'mastodon' | 'nostr';
export type RegistrationStatus = 'pending' | 'created' | 'failed';

export interface PlatformRegistration {
  platform: RegistrationPlatform;
  status: RegistrationStatus;
  username?: string;
  error?: string;
  txHash?: string;
  accountInfo?: Record<string, string>;
}

export interface RegisterOptions {
  storage?: KVNamespace;
  walletAddress: string;
  identity?: UnifiedIdentity;
  baseRpcUrl?: string;
  premiumWalletPrivateKey?: string;
  polygonRpcUrl?: string;
  bskyPdsUrl?: string;
  blueskyInvitePool?: KVNamespace;
  mastodonInstanceUrl?: string;
  mastodonAccessToken?: string;
}
