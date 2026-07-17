import { getDb } from './db';
import type { StoredBlockedUser } from './types';

async function syncBlockAction(
  targetId: string,
  targetHandle: string,
  protocol: string,
  action: 'block' | 'unblock',
): Promise<void> {
  try {
    await fetch('/api/moderation/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, targetHandle, protocol, action }),
    });
  } catch {
    /* non-critical — offline or server unavailable */
  }
}

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
  // Sync to server KV so the block persists across devices
  void syncBlockAction(targetId, targetHandle, protocol, 'block');
}

export async function removeBlockedUser(
  targetId: string,
  blockedByIdentityId: string,
): Promise<void> {
  const db = await getDb();
  await db.delete('blocked', [targetId, blockedByIdentityId]);
  // Sync to server KV
  void syncBlockAction(targetId, '', '', 'unblock');
}

/**
 * Fetch blocked/muted users from the server and merge into local IndexedDB.
 * Call on app load to pick up blocks/mutes performed on other devices.
 * Writes directly to IndexedDB to avoid re-triggering server sync POSTs.
 */
export async function syncBlockedFromServer(): Promise<void> {
  try {
    const res = await fetch('/api/moderation/sync');
    if (!res.ok) return;
    const data = await res.json();
    const db = await getDb();

    // Merge server block list into local IndexedDB (directly, to avoid sync loop)
    for (const entry of data.blocked || []) {
      const existing = await db.get('blocked', [entry.targetId, entry.blockedBy || 'self']);
      if (!existing) {
        await db.put('blocked', {
          targetId: entry.targetId,
          targetHandle: entry.targetHandle || '',
          protocol: entry.protocol || '',
          blockedBy: entry.blockedBy || 'self',
          blockedAt: entry.blockedAt || Date.now(),
        } satisfies StoredBlockedUser);
      }
    }

    // Merge server mute list into local IndexedDB
    const { muteIdentity } = await import('./muting');
    for (const entry of data.muted || []) {
      await muteIdentity(entry.targetId, entry.targetHandle || '');
    }
  } catch {
    /* offline — use local only */
  }
}

export async function isBlocked(targetId: string, blockedByIdentityId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.get('blocked', [targetId, blockedByIdentityId]);
  return result !== undefined;
}

export async function getBlockedUsers(blockedByIdentityId: string): Promise<StoredBlockedUser[]> {
  const db = await getDb();
  const index = (db as import('idb').IDBPDatabase<{ blocked: StoredBlockedUser }>)
    .transaction('blocked')
    .store.index('blockedBy');
  return (await index.getAll(blockedByIdentityId)) as StoredBlockedUser[];
}
