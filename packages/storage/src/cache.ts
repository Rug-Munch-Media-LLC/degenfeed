import type { IDBPDatabase } from 'idb';

// ─── Cached Posts ──────────────────────────────────────────────────────

import { getDb } from './db';
/**
 * Save a post to the cache. Replaces if exists.
 * Cache has a max size (LRU eviction).
 */
import type { StoredCachedPost } from './types';
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
