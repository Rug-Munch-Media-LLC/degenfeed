/**
 * @degenfeed/storage — moderation.ts
 *
 * Unified mute/block configuration: words, users, communities.
 * Persists to IndexedDB and syncs to server KV for cross-device availability.
 */

import { getDb } from './db';
import type {
  StoredBlockedCommunity,
  StoredBlockedUser,
  StoredMutedCommunity,
  StoredMutedIdentity,
  StoredMutedWord,
} from './types';

// ─── Types ────────────────────────────────────────────────────────────

export interface MutedUserEntry {
  targetId: string;
  targetHandle: string;
  protocol: string;
  mutedAt: number;
}

export interface MutedCommunityEntry {
  communityId: string;
  communityName: string;
  instance?: string;
  mutedAt: number;
}

export interface BlockedCommunityEntry {
  communityId: string;
  communityName: string;
  instance?: string;
  blockedAt: number;
}

export interface MuteConfig {
  words: string[];
  users: MutedUserEntry[];
  communities: MutedCommunityEntry[];
  blockedUsers: StoredBlockedUser[];
  blockedCommunities: BlockedCommunityEntry[];
}

// ─── Sync helpers ─────────────────────────────────────────────────────

type SyncAction =
  | { action: 'mute_word' | 'unmute_word'; word: string }
  | { action: 'mute' | 'unmute'; targetId: string; targetHandle: string; protocol: string }
  | {
      action: 'mute_community' | 'unmute_community';
      communityId: string;
      communityName: string;
      instance?: string;
    }
  | {
      action: 'block_community' | 'unblock_community';
      communityId: string;
      communityName: string;
      instance?: string;
    };

async function syncAction(payload: SyncAction): Promise<void> {
  try {
    await fetch('/api/moderation/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    /* non-critical — offline or server unavailable */
  }
}

// ─── Mute config: read all ────────────────────────────────────────────

export async function getMuteConfig(): Promise<MuteConfig> {
  const db = await getDb();
  const tx = db.transaction([
    'muted-words',
    'muted',
    'muted-communities',
    'blocked',
    'blocked-communities',
  ]);

  const wordStore = tx.objectStore('muted-words');
  const wordsIndex = wordStore.index('mutedBy');
  const words = (await wordsIndex.getAll('self')) as StoredMutedWord[];

  const userStore = tx.objectStore('muted');
  const usersIndex = userStore.index('mutedBy');
  const users = (await usersIndex.getAll('self')) as StoredMutedIdentity[];

  const communityStore = tx.objectStore('muted-communities');
  const communitiesIndex = communityStore.index('mutedBy');
  const communities = (await communitiesIndex.getAll('self')) as StoredMutedCommunity[];

  const blockedStore = tx.objectStore('blocked');
  const blockedIndex = blockedStore.index('blockedBy');
  const blockedUsers = (await blockedIndex.getAll('self')) as StoredBlockedUser[];

  const blockedCommunityStore = tx.objectStore('blocked-communities');
  const blockedCommunitiesIndex = blockedCommunityStore.index('blockedBy');
  const blockedCommunities = (await blockedCommunitiesIndex.getAll(
    'self',
  )) as StoredBlockedCommunity[];

  return {
    words: words.map((w) => w.word),
    users: users.map((u) => ({
      targetId: u.targetId,
      targetHandle: u.targetHandle,
      protocol: '',
      mutedAt: u.mutedAt,
    })),
    communities: communities.map((c) => ({
      communityId: c.communityId,
      communityName: c.communityName,
      instance: c.instance,
      mutedAt: c.mutedAt,
    })),
    blockedUsers,
    blockedCommunities: blockedCommunities.map((c) => ({
      communityId: c.communityId,
      communityName: c.communityName,
      instance: c.instance,
      blockedAt: c.blockedAt,
    })),
  };
}

// ─── Muted words ──────────────────────────────────────────────────────

export async function addMutedWord(word: string): Promise<void> {
  const db = await getDb();
  await db.put('muted-words', {
    word: word.toLowerCase(),
    mutedBy: 'self',
    mutedAt: Date.now(),
  } satisfies StoredMutedWord);
  void syncAction({ action: 'mute_word', word: word.toLowerCase() });
}

export async function removeMutedWord(word: string): Promise<void> {
  const db = await getDb();
  await db.delete('muted-words', [word.toLowerCase(), 'self']);
  void syncAction({ action: 'unmute_word', word: word.toLowerCase() });
}

// ─── Muted users ──────────────────────────────────────────────────────

export async function muteUser(userId: string, protocol: string, handle?: string): Promise<void> {
  const db = await getDb();
  await db.put('muted', {
    targetId: userId,
    targetHandle: handle ?? '',
    mutedBy: 'self',
    mutedAt: Date.now(),
  } satisfies StoredMutedIdentity);
  void syncAction({ action: 'mute', targetId: userId, targetHandle: handle ?? '', protocol });
}

export async function unmuteUser(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete('muted', [userId, 'self']);
  void syncAction({ action: 'unmute', targetId: userId, targetHandle: '', protocol: '' });
}

// ─── Muted communities ────────────────────────────────────────────────

export async function muteCommunity(
  communityId: string,
  communityName: string,
  instance?: string,
): Promise<void> {
  const db = await getDb();
  await db.put('muted-communities', {
    communityId,
    communityName,
    instance,
    mutedBy: 'self',
    mutedAt: Date.now(),
  } satisfies StoredMutedCommunity);
  void syncAction({ action: 'mute_community', communityId, communityName, instance });
}

export async function unmuteCommunity(communityId: string): Promise<void> {
  const db = await getDb();
  await db.delete('muted-communities', [communityId, 'self']);
  void syncAction({ action: 'unmute_community', communityId, communityName: '', instance: '' });
}

// ─── Blocked communities ──────────────────────────────────────────────

export async function blockCommunity(
  communityId: string,
  communityName: string,
  instance?: string,
): Promise<void> {
  const db = await getDb();
  await db.put('blocked-communities', {
    communityId,
    communityName,
    instance,
    blockedBy: 'self',
    blockedAt: Date.now(),
  } satisfies StoredBlockedCommunity);
  void syncAction({
    action: 'block_community',
    communityId,
    communityName,
    instance,
  });
}

export async function unblockCommunity(communityId: string): Promise<void> {
  const db = await getDb();
  await db.delete('blocked-communities', [communityId, 'self']);
  void syncAction({
    action: 'unblock_community',
    communityId,
    communityName: '',
    instance: '',
  });
}

export async function getMutedCommunities(): Promise<StoredMutedCommunity[]> {
  const db = await getDb();
  const index = (db as import('idb').IDBPDatabase<{ 'muted-communities': StoredMutedCommunity }>)
    .transaction('muted-communities')
    .store.index('mutedBy');
  return (await index.getAll('self')) as StoredMutedCommunity[];
}

export async function getBlockedCommunities(): Promise<StoredBlockedCommunity[]> {
  const db = await getDb();
  const index = (
    db as import('idb').IDBPDatabase<{ 'blocked-communities': StoredBlockedCommunity }>
  )
    .transaction('blocked-communities')
    .store.index('blockedBy');
  return (await index.getAll('self')) as StoredBlockedCommunity[];
}

export async function isCommunityMuted(communityId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.get('muted-communities', [communityId, 'self']);
  return result !== undefined;
}

export async function isCommunityBlocked(communityId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.get('blocked-communities', [communityId, 'self']);
  return result !== undefined;
}
