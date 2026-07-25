import type { UnifiedIdentity } from '@degenfeed/types';

export type RegistrationPlatform =
  | 'farcaster'
  | 'lens'
  | 'bluesky'
  | 'mastodon'
  | 'nostr'
  | 'lemmy'
  | 'peertube'
  | 'pixelfed'
  | 'bookwyrm'
  | 'funkwhale'
  | 'mobilizon'
  | 'writefreely'
  | 'owncast'
  | 'castopod';

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
  /** Optional callback to encrypt secrets before storing in KV. */
  sealSecret?: (plaintext: string) => Promise<string>;
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
  /** Lemmy instance URL (default: https://community.degenfeed.xyz) */
  lemmyInstanceUrl?: string;
  /** PeerTube instance URL (default: https://video.degenfeed.xyz) */
  peertubeInstanceUrl?: string;
  /** Pixelfed instance URL (default: https://pixelfed.social) */
  pixelfedInstanceUrl?: string;
  /** BookWyrm instance URL (default: https://books.degenfeed.xyz) */
  bookwyrmInstanceUrl?: string;
  /** Funkwhale instance URL (default: https://music.degenfeed.xyz) */
  funkwhaleInstanceUrl?: string;
  /** Mobilizon instance URL (default: https://events.degenfeed.xyz) */
  mobilizonInstanceUrl?: string;
  /** WriteFreely instance URL (default: https://blog.degenfeed.xyz) */
  writefreelyInstanceUrl?: string;
  /** Owncast instance URL (default: https://live.degenfeed.xyz) */
  owncastInstanceUrl?: string;
  /** Owncast admin API key (for user creation) */
  owncastAdminKey?: string;
  /** Castopod instance URL (default: https://podcasts.degenfeed.xyz) */
  castopodInstanceUrl?: string;
}
