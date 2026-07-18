/**
 * @degenfeed/storage
 *
 * Typed IndexedDB wrapper for all client-side persistence.
 * Uses `idb` for a clean promise-based API without raw IDB transactions.
 *
 * Stores:
 *   identities   — Encrypted identity records (protocol keys)
 *   follows      — Follow graph per identity
 *   drafts       — Composer drafts (per-protocol, per-identity)
 *   cached-posts — LRU cache of recently fetched posts
 *   muted        — Muted identities and words
 *   prefs        — User preferences (ranking weights, theme, etc.)
 *   monetization — Creator tipping/monetization preferences
 *
 * Encryption is handled by @degenfeed/auth; this package only persists
 * the pre-encrypted blobs and decryptable fields.
 */

import type { Protocol, StoredIdentity } from '@degenfeed/types';

// ─── Schema Types ──────────────────────────────────────────────────────

// StoredIdentity is defined in @degenfeed/types to prevent a circular
// dependency between @degenfeed/auth and @degenfeed/storage.
// Both packages import it from @degenfeed/types instead.

export type { StoredIdentity };

export interface StoredFollow {
  identityId: string; // our identity that follows
  targetId: string; // target's canonical id (e.g. "nostr:abc123")
  targetProtocol: Protocol;
  targetHandle: string;
  followedAt: number;
}

export interface StoredDraft {
  id: string;
  identityId: string;
  protocol: Protocol;
  content: string;
  parentId?: string; // for replies
  createdAt: number;
  updatedAt: number;
}

export interface StoredCachedPost {
  postId: string;
  /** The serialized post */
  data: string; // JSON string of the post
  cachedAt: number;
}

export interface StoredBlockedUser {
  targetId: string;
  targetHandle: string;
  protocol: string;
  blockedBy: string; // our identity id
  blockedAt: number;
}

export interface StoredMutedIdentity {
  targetId: string;
  targetHandle: string;
  mutedBy: string; // our identity id
  mutedAt: number;
}

export interface StoredMutedWord {
  word: string;
  mutedBy: string;
  mutedAt: number;
}

export interface StoredMutedCommunity {
  communityId: string; // e.g. "lemmy:memes@lemmy.world" or community actorId
  communityName: string;
  instance?: string;
  mutedBy: string;
  mutedAt: number;
}

export interface StoredBlockedCommunity {
  communityId: string;
  communityName: string;
  instance?: string;
  blockedBy: string;
  blockedAt: number;
}

export type FeedLayout = 'compact' | 'comfortable' | 'media-grid' | 'reader';

/** @deprecated Use FeedLayout instead */
export type LayoutDensity = FeedLayout;

export interface UserPreferences {
  identityId: string;
  theme: 'dark' | 'light' | 'auto';
  rankingWeights: Record<string, number> | null;
  pinnedRelays: string[];
  pinnedHubs: string[];
  defaultProtocols: Protocol[];
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
  preferredNiches: string[];
  preferredPlatforms: Protocol[];
  recencyWeight: number;
  engagementWeight: number;
  diversityBoost: boolean;
  feedLayout: FeedLayout;
  /** Per-protocol quality preset selections (e.g. { farcaster: 'quality', nostr: 'balanced' }) */
  protocolPresets?: Record<string, string>;
}

export type SubscriptionTier = 'free' | 'pro' | 'creator';

export interface SubscriptionRecord {
  identityId: string;
  tier: SubscriptionTier;
  expiresAt: number;
  startedAt: number;
  txSignature?: string;
  paymentAddress?: string;
}

export interface MonetizationPreferences {
  identityId: string;
  updatedAt: number;
  /** Default EVM address used across Ethereum, Base, Optimism, Arbitrum, Polygon */
  evmAddress?: string;
  /** Solana address for direct SOL/SPL transfers */
  solanaAddress?: string;
  /** Lightning address (user@domain.com) or LNURL */
  lightningAddress?: string;
  /** Farcaster custody address for Frame tips */
  farcasterCustodyAddress?: string;
  /** Lens profile id (e.g. 0x01) or handle */
  lensProfile?: string;
  /** Nostr pubkey for zaps */
  nostrPubkey?: string;
  /** Preferred default method when multiple are available */
  preferredMethod?: string;
}
