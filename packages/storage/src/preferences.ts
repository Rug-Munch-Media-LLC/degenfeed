// ─── Preferences ───────────────────────────────────────────────────────

import { getDb } from './db';
import { clearAllSessions } from './session';
import type {
  StoredFollow,
  StoredIdentity,
  StoredMutedIdentity,
  StoredMutedWord,
  UserPreferences,
} from './types';
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
  const _dbPromise = null;
}
