import { getDb } from './db';
import type { StoredBlockedUser } from './types';

export async function addBlockedUser(
  targetId: string,
  targetHandle: string,
  protocol: string,
  blockedByIdentityId: string,
): Promise<void> {
  const db = await getDb();
  await db.put('blocked', {
    targetId,
    targetHandle,
    protocol,
    blockedBy: blockedByIdentityId,
    blockedAt: Date.now(),
  } satisfies StoredBlockedUser);
}

export async function removeBlockedUser(
  targetId: string,
  blockedByIdentityId: string,
): Promise<void> {
  const db = await getDb();
  await db.delete('blocked', [targetId, blockedByIdentityId]);
}

export async function isBlocked(
  targetId: string,
  blockedByIdentityId: string,
): Promise<boolean> {
  const db = await getDb();
  const result = await db.get('blocked', [targetId, blockedByIdentityId]);
  return result !== undefined;
}

export async function getBlockedUsers(
  blockedByIdentityId: string,
): Promise<StoredBlockedUser[]> {
  const db = await getDb();
  const index = (db as import('idb').IDBPDatabase<{ blocked: StoredBlockedUser }>)
    .transaction('blocked')
    .store.index('blockedBy');
  return (await index.getAll(blockedByIdentityId)) as StoredBlockedUser[];
}
