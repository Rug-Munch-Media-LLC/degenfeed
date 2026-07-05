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
import { type IDBPDatabase, openDB } from 'idb';

// ─── Active Session (in-memory only) ───────────────────────────────────

import { StoredIdentity } from './types';
export interface ActiveSession {
  identity: StoredIdentity;
  /** Decrypted key material. NEVER written to disk. */
  decryptedSecret: string | null;
  unlockedAt: number;
}

const activeSessions = new Map<string, ActiveSession>();

export function setActiveSession(identityId: string, session: ActiveSession): void {
  activeSessions.set(identityId, session);
}

export function getActiveSession(identityId: string): ActiveSession | undefined {
  return activeSessions.get(identityId);
}

export function clearActiveSession(identityId: string): void {
  activeSessions.delete(identityId);
}

export function clearAllSessions(): void {
  activeSessions.clear();
}

