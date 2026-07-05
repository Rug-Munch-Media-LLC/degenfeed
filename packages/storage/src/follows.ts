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

// ─── Follows CRUD ──────────────────────────────────────────────────────

import { StoredFollow } from './types';
import { getDb } from './db';
export async function saveFollow(follow: StoredFollow): Promise<void> {
  const db = await getDb();
  await db.put('follows', follow);
}

export async function deleteFollow(identityId: string, targetId: string): Promise<void> {
  const db = await getDb();
  await db.delete('follows', [identityId, targetId]);
}

export async function getFollows(identityId: string): Promise<StoredFollow[]> {
  const db = await getDb();
  const index = (db as IDBPDatabase<{ follows: StoredFollow }>)
    .transaction('follows')
    .store.index('identityId');
  return (await index.getAll(identityId)) as StoredFollow[];
}

export async function isFollowing(identityId: string, targetId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.get('follows', [identityId, targetId]);
  return result !== undefined;
}

