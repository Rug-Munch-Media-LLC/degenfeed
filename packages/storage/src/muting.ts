import type { IDBPDatabase } from 'idb';

// ─── Muting ────────────────────────────────────────────────────────────

import { getDb } from './db';
import type { StoredMutedIdentity, StoredMutedWord } from './types';

async function syncMuteAction(
  targetId: string,
  targetHandle: string,
  action: 'mute' | 'unmute',
): Promise<void> {
  try {
    await fetch('/api/moderation/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, targetHandle, protocol: '', action }),
    });
  } catch {
    /* non-critical — offline or server unavailable */
  }
}

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
  // Sync to server KV
  void syncMuteAction(targetIdentityId, targetHandle, 'mute');
}

export async function unmuteIdentity(
  targetIdentityId: string,
  mutedByIdentityId: string,
): Promise<void> {
  const db = await getDb();
  await db.delete('muted', [targetIdentityId, mutedByIdentityId]);
  // Sync to server KV
  void syncMuteAction(targetIdentityId, '', 'unmute');
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
