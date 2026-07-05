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

// ─── Preferences ───────────────────────────────────────────────────────

import { StoredIdentity, StoredFollow, UserPreferences, StoredMutedIdentity, StoredMutedWord } from './types';
import { getDb, dbPromise as _dbPromise } from './db';
import { clearAllSessions } from './session';
export async function savePreferences(prefs: UserPreferences): Promise<void> {
  const db = await getDb();
  await db.put('prefs', prefs);
}

export async function getPreferences(identityId: string): Promise<UserPreferences | undefined> {
  const db = await getDb();
  return (await db.get('prefs', identityId)) as UserPreferences | undefined;
}

export async function getDefaultPreferences(identityId: string): Promise<UserPreferences> {
  return {
    identityId,
    theme: 'dark',
    rankingWeights: null,
    pinnedRelays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'],
    pinnedHubs: ['https://hub.farcaster.standardcrypto.vc:2281'],
    defaultProtocols: ['nostr', 'farcaster', 'lens', 'bluesky'],
    reducedMotion: false,
    fontSize: 'medium',
  } satisfies UserPreferences;
}

// ─── Data Management ──────────────────────────────────────────────────

export interface ExportData {
  version: 1;
  exportedAt: number;
  identities: StoredIdentity[];
  follows: StoredFollow[];
  prefs: UserPreferences[];
  mutedIdentities: StoredMutedIdentity[];
  mutedWords: StoredMutedWord[];
}

/**
 * Export all data (except cached posts and active sessions) as JSON.
 * The user can download this for backup purposes.
 */
export async function exportData(): Promise<ExportData> {
  const db = await getDb();
  const [identities, follows, prefs, mutedIdentities, mutedWords] = await Promise.all([
    db.getAll('identities') as Promise<StoredIdentity[]>,
    db.getAll('follows') as Promise<StoredFollow[]>,
    db.getAll('prefs') as Promise<UserPreferences[]>,
    db.getAll('muted') as Promise<StoredMutedIdentity[]>,
    db.getAll('muted-words') as Promise<StoredMutedWord[]>,
  ]);

  return {
    version: 1,
    exportedAt: Date.now(),
    identities,
    follows,
    prefs,
    mutedIdentities,
    mutedWords,
  };
}

/**
 * Wipe all data from the database. Clears every store.
 * Used for account deletion or full reset.
 */
export async function wipeAll(): Promise<void> {
  clearAllSessions();
  const db = await getDb();
  await Promise.all([
    db.clear('identities'),
    db.clear('follows'),
    db.clear('drafts'),
    db.clear('cached-posts'),
    db.clear('muted'),
    db.clear('muted-words'),
    db.clear('prefs'),
  ]);
}

/**
 * Close the database connection. Call on app unmount.
 */
export function closeDb(): void {
  const dbPromise = null;
}
