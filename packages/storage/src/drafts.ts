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

// ─── Drafts CRUD ───────────────────────────────────────────────────────

import { StoredDraft } from './types';
import { getDb } from './db';
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

