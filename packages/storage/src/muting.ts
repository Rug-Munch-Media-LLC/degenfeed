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

// ─── Muting ────────────────────────────────────────────────────────────

import { StoredMutedIdentity, StoredMutedWord } from './types';
import { getDb } from './db';
export async function muteIdentity(
  targetIdentityId: string,
  targetHandle: string,
  mutedByIdentityId: string,
): Promise<void> {
  const db = await getDb();
  await db.put('muted', {
    targetId: targetIdentityId,
    targetHandle,
    mutedBy: mutedByIdentityId,
    mutedAt: Date.now(),
  } satisfies StoredMutedIdentity);
}

export async function unmuteIdentity(
  targetIdentityId: string,
  mutedByIdentityId: string,
): Promise<void> {
  const db = await getDb();
  await db.delete('muted', [targetIdentityId, mutedByIdentityId]);
}

export async function getMutedIdentities(
  mutedByIdentityId: string,
): Promise<StoredMutedIdentity[]> {
  const db = await getDb();
  const index = (db as IDBPDatabase<{ muted: StoredMutedIdentity }>)
    .transaction('muted')
    .store.index('mutedBy');
  return (await index.getAll(mutedByIdentityId)) as StoredMutedIdentity[];
}

export async function isMutedIdentity(
  targetIdentityId: string,
  mutedByIdentityId: string,
): Promise<boolean> {
  const db = await getDb();
  const result = await db.get('muted', [targetIdentityId, mutedByIdentityId]);
  return result !== undefined;
}

export async function muteWord(word: string, mutedByIdentityId: string): Promise<void> {
  const db = await getDb();
  await db.put('muted-words', {
    word: word.toLowerCase(),
    mutedBy: mutedByIdentityId,
    mutedAt: Date.now(),
  } satisfies StoredMutedWord);
}

export async function unmuteWord(word: string, mutedByIdentityId: string): Promise<void> {
  const db = await getDb();
  await db.delete('muted-words', [word.toLowerCase(), mutedByIdentityId]);
}

export async function getMutedWords(mutedByIdentityId: string): Promise<StoredMutedWord[]> {
  const db = await getDb();
  const index = (db as IDBPDatabase<{ 'muted-words': StoredMutedWord }>)
    .transaction('muted-words')
    .store.index('mutedBy');
  return (await index.getAll(mutedByIdentityId)) as StoredMutedWord[];
}

