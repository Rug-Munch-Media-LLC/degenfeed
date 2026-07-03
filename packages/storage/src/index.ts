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

// ─── Schema Types ──────────────────────────────────────────────────────

export interface StoredIdentity {
  /** Canonical id: `${protocol}:${publicId}` */
  id: string;
  protocol: Protocol;
  publicId: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  /** Timestamp of when this identity was first linked */
  linkedAt: number;
  /** Whether the identity has been verified (NIP-05, Farcaster verified) */
  verified: boolean;
  /** Encrypted secret key (AES-GCM ciphertext, base64) */
  encryptedSecret: string | null;
  /** Argon2id salt for key derivation (base64) */
  salt: string;
  /** AES-GCM initialization vector (base64) */
  iv: string;
  /** Whether this is the user's primary identity */
  isPrimary: boolean;
}

export interface StoredFollow {
  identityId: string; // our identity that follows
  targetId: string; // target's canonical id (e.g. "nostr:abc123")
  targetProtocol: Protocol;
  targetHandle: string;
  followedAt: number;
}

export interface StoredDraft {
  id: string;
  identityId: string;
  protocol: Protocol;
  content: string;
  parentId?: string; // for replies
  createdAt: number;
  updatedAt: number;
}

export interface StoredCachedPost {
  postId: string;
  /** The serialized post */
  data: string; // JSON string of the post
  cachedAt: number;
}

export interface StoredMutedIdentity {
  targetId: string;
  targetHandle: string;
  mutedBy: string; // our identity id
  mutedAt: number;
}

export interface StoredMutedWord {
  word: string;
  mutedBy: string;
  mutedAt: number;
}

export interface UserPreferences {
  identityId: string;
  theme: 'dark' | 'light' | 'auto';
  rankingWeights: Record<string, number> | null; // null = use defaults
  pinnedRelays: string[];
  pinnedHubs: string[];
  defaultProtocols: Protocol[];
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

// ─── Active Session (in-memory only) ───────────────────────────────────

export interface ActiveSession {
  identity: StoredIdentity;
  /** Decrypted key material. NEVER written to disk. */
  decryptedSecret: string | null;
  unlockedAt: number;
}

const activeSessions = new Map<string, ActiveSession>();

export function setActiveSession(identityId: string, session: ActiveSession): void {
  activeSessions.set(identityId, session);
}

export function getActiveSession(identityId: string): ActiveSession | undefined {
  return activeSessions.get(identityId);
}

export function clearActiveSession(identityId: string): void {
  activeSessions.delete(identityId);
}

export function clearAllSessions(): void {
  activeSessions.clear();
}

// ─── Database ──────────────────────────────────────────────────────────

const DB_NAME = 'degenfeed';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

async function getDb(): Promise<IDBPDatabase<unknown>> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Identities store
        if (!db.objectStoreNames.contains('identities')) {
          const store = db.createObjectStore('identities', {
            keyPath: 'id',
          });
          store.createIndex('protocol', 'protocol');
          store.createIndex('isPrimary', 'isPrimary');
        }
        // Follows store
        if (!db.objectStoreNames.contains('follows')) {
          const store = db.createObjectStore('follows', {
            keyPath: ['identityId', 'targetId'],
          });
          store.createIndex('identityId', 'identityId');
          store.createIndex('targetProtocol', 'targetProtocol');
        }
        // Drafts store
        if (!db.objectStoreNames.contains('drafts')) {
          const store = db.createObjectStore('drafts', {
            keyPath: 'id',
          });
          store.createIndex('identityId', 'identityId');
          store.createIndex('updatedAt', 'updatedAt');
        }
        // Cached posts store
        if (!db.objectStoreNames.contains('cached-posts')) {
          const store = db.createObjectStore('cached-posts', {
            keyPath: 'postId',
          });
          store.createIndex('cachedAt', 'cachedAt');
        }
        // Muted identities store
        if (!db.objectStoreNames.contains('muted')) {
          const store = db.createObjectStore('muted', {
            keyPath: ['targetId', 'mutedBy'],
          });
          store.createIndex('mutedBy', 'mutedBy');
        }
        // Muted words store
        if (!db.objectStoreNames.contains('muted-words')) {
          const store = db.createObjectStore('muted-words', {
            keyPath: ['word', 'mutedBy'],
          });
          store.createIndex('mutedBy', 'mutedBy');
        }
        // Preferences store
        if (!db.objectStoreNames.contains('prefs')) {
          db.createObjectStore('prefs', {
            keyPath: 'identityId',
          });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Identity CRUD ─────────────────────────────────────────────────────

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  const db = await getDb();
  await db.put('identities', identity);
}

export async function getIdentity(id: string): Promise<StoredIdentity | undefined> {
  const db = await getDb();
  return (await db.get('identities', id)) as StoredIdentity | undefined;
}

export async function getAllIdentities(): Promise<StoredIdentity[]> {
  const db = await getDb();
  return (await db.getAll('identities')) as StoredIdentity[];
}

export async function getIdentitiesByProtocol(protocol: Protocol): Promise<StoredIdentity[]> {
  const db = await getDb();
  const index = (db as IDBPDatabase<{ identities: StoredIdentity }>)
    .transaction('identities')
    .store.index('protocol');
  return (await index.getAll(protocol)) as StoredIdentity[];
}

export async function getPrimaryIdentity(): Promise<StoredIdentity | undefined> {
  const all = await getAllIdentities();
  return all.find((i) => i.isPrimary);
}

export async function setPrimaryIdentity(id: string): Promise<void> {
  const all = await getAllIdentities();
  for (const identity of all) {
    if (identity.id === id) {
      identity.isPrimary = true;
      await saveIdentity(identity);
    } else if (identity.isPrimary) {
      identity.isPrimary = false;
      await saveIdentity(identity);
    }
  }
}

export async function deleteIdentity(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('identities', id);
  // Also clean up follows, drafts, prefs for this identity
  const tx = db.transaction(['follows', 'drafts', 'prefs'], 'readwrite');
  // Follows: delete by identityId
  const followIndex = tx.objectStore('follows').index('identityId');
  let followCursor = await followIndex.openCursor(id);
  while (followCursor) {
    followCursor.delete();
    followCursor = await followCursor.continue();
  }
  // Drafts: delete by identityId
  const draftIndex = tx.objectStore('drafts').index('identityId');
  let draftCursor = await draftIndex.openCursor(id);
  while (draftCursor) {
    draftCursor.delete();
    draftCursor = await draftCursor.continue();
  }
  // Preferences
  tx.objectStore('prefs').delete(id);
  await tx.done;
}

// ─── Follows CRUD ──────────────────────────────────────────────────────

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

// ─── Drafts CRUD ───────────────────────────────────────────────────────

export async function saveDraft(draft: StoredDraft): Promise<void> {
  draft.updatedAt = Date.now();
  const db = await getDb();
  await db.put('drafts', draft);
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('drafts', id);
}

export async function getDrafts(identityId: string): Promise<StoredDraft[]> {
  const db = await getDb();
  const index = (db as IDBPDatabase<{ drafts: StoredDraft }>)
    .transaction('drafts')
    .store.index('identityId');
  return (await index.getAll(identityId)) as StoredDraft[];
}

// ─── Cached Posts ──────────────────────────────────────────────────────

/**
 * Save a post to the cache. Replaces if exists.
 * Cache has a max size (LRU eviction).
 */
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

// ─── Muting ────────────────────────────────────────────────────────────

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

// ─── Preferences ───────────────────────────────────────────────────────

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
  dbPromise = null;
}
