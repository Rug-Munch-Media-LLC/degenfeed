import type { IDBPDatabase } from 'idb';

// ─── Drafts CRUD ───────────────────────────────────────────────────────

import { getDb } from './db';
import type { StoredDraft } from './types';
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
