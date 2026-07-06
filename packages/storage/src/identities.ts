import type { Protocol } from '@degenfeed/types';
import { getDb } from './db';
import type { StoredIdentity } from './types';

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  const db = await getDb();
  await db.put('identities', identity);
}

export async function getIdentity(id: string): Promise<StoredIdentity | undefined> {
  const db = await getDb();
  return db.get('identities', id);
}

export async function getAllIdentities(): Promise<StoredIdentity[]> {
  const db = await getDb();
  return db.getAll('identities');
}

export async function getIdentitiesByProtocol(protocol: Protocol): Promise<StoredIdentity[]> {
  const db = await getDb();
  return db.getAllFromIndex('identities', 'byProtocol', protocol);
}

export async function getPrimaryIdentity(): Promise<StoredIdentity | undefined> {
  const db = await getDb();
  const all = await db.getAllFromIndex('identities', 'byPrimary', 1);
  return all[0];
}

export async function setPrimaryIdentity(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('identities', 'readwrite');
  const all = await tx.store.getAll();
  await Promise.all(
    all.map((identity: StoredIdentity) =>
      tx.store.put({ ...identity, isPrimary: identity.id === id }),
    ),
  );
  await tx.done;
}

export async function deleteIdentity(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('identities', id);
}
