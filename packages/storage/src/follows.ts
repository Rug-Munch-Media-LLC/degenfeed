import type { IDBPDatabase } from 'idb';

// ─── Follows CRUD ──────────────────────────────────────────────────────

import { getDb } from './db';
import type { StoredFollow } from './types';
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
