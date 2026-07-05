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

// ─── Cached Posts ──────────────────────────────────────────────────────

/**
 * Save a post to the cache. Replaces if exists.
 * Cache has a max size (LRU eviction).
 */
import { StoredCachedPost } from './types';
import { getDb } from './db';
export async function cachePost(postId: string, data: string): Promise<void> {
  const db = await getDb();
  const entry: StoredCachedPost = {
    postId,
    data,
    cachedAt: Date.now(),
  };
  await db.put('cached-posts', entry);

  // Evict old entries if cache is too large (>500 posts)
  const count = await db.count('cached-posts');
  if (count > 500) {
    const index = (db as IDBPDatabase<{ 'cached-posts': StoredCachedPost }>)
      .transaction('cached-posts', 'readwrite')
      .store.index('cachedAt');
    let cursor = await index.openCursor();
    let evicted = 0;
    while (cursor && evicted < count - 400) {
      cursor.delete();
      evicted++;
      cursor = await cursor.continue();
    }
  }
}

export async function getCachedPost(postId: string): Promise<string | undefined> {
  const db = await getDb();
  const entry = (await db.get('cached-posts', postId)) as StoredCachedPost | undefined;
  return entry?.data;
}

export async function clearCache(): Promise<void> {
  const db = await getDb();
  await db.clear('cached-posts');
}

