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
 *
 * Encryption is handled by @degenfeed/auth; this package only persists
 * the pre-encrypted blobs and decryptable fields.
 */

import type { Protocol } from '@degenfeed/types';

// ─── Schema Types ──────────────────────────────────────────────────────

export interface StoredIdentity {
  /** Canonical id: `${protocol}:${publicId}` */
  id: string;
  protocol: Protocol;
  publicId: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  /** Timestamp of when this identity was first linked */
  linkedAt: number;
  /** Whether the identity has been verified (NIP-05, Farcaster verified) */
  verified: boolean;
  /** Encrypted secret key (AES-GCM ciphertext, base64) */
  encryptedSecret: string | null;
  /** Argon2id salt for key derivation (base64) */
  salt: string;
  /** AES-GCM initialization vector (base64) */
  iv: string;
  /** Whether this is the user's primary identity */
  isPrimary: boolean;
  /** Protocol-specific key material (encrypted) */
  keys?: Record<string, string | null>;
  /** Social links */
  links?: Array<{ label: string; url: string }>;
  /** Creation timestamp */
  createdAt?: number;
}

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

export interface UserPreferences {
  identityId: string;
  theme: 'dark' | 'light' | 'auto';
  rankingWeights: Record<string, number> | null; // null = use defaults
  pinnedRelays: string[];
  pinnedHubs: string[];
  defaultProtocols: Protocol[];
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
}
