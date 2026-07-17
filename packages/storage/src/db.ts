import { type IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'degenfeed';
const DB_VERSION = 6;

export let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

export async function getDb(): Promise<IDBPDatabase<unknown>> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('identities')) {
          const store = db.createObjectStore('identities', { keyPath: 'id' });
          store.createIndex('protocol', 'protocol');
          store.createIndex('isPrimary', 'isPrimary');
        }
        if (!db.objectStoreNames.contains('follows')) {
          const store = db.createObjectStore('follows', { keyPath: ['identityId', 'targetId'] });
          store.createIndex('identityId', 'identityId');
          store.createIndex('targetProtocol', 'targetProtocol');
        }
        if (!db.objectStoreNames.contains('drafts')) {
          const store = db.createObjectStore('drafts', { keyPath: 'id' });
          store.createIndex('identityId', 'identityId');
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('cached-posts')) {
          const store = db.createObjectStore('cached-posts', { keyPath: 'postId' });
          store.createIndex('cachedAt', 'cachedAt');
        }
        if (!db.objectStoreNames.contains('muted')) {
          const store = db.createObjectStore('muted', { keyPath: ['targetId', 'mutedBy'] });
          store.createIndex('mutedBy', 'mutedBy');
        }
        if (!db.objectStoreNames.contains('muted-words')) {
          const store = db.createObjectStore('muted-words', { keyPath: ['word', 'mutedBy'] });
          store.createIndex('mutedBy', 'mutedBy');
        }
        if (!db.objectStoreNames.contains('prefs')) {
          db.createObjectStore('prefs', { keyPath: 'identityId' });
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          const store = db.createObjectStore('bookmarks', { keyPath: 'postId' });
          store.createIndex('savedAt', 'savedAt');
        }
        if (!db.objectStoreNames.contains('monetization')) {
          db.createObjectStore('monetization', { keyPath: 'identityId' });
        }
        if (!db.objectStoreNames.contains('subscriptions')) {
          db.createObjectStore('subscriptions', { keyPath: 'identityId' });
        }
        if (!db.objectStoreNames.contains('blocked')) {
          const store = db.createObjectStore('blocked', { keyPath: ['targetId', 'blockedBy'] });
          store.createIndex('blockedBy', 'blockedBy');
        }
        if (!db.objectStoreNames.contains('scheduled')) {
          db.createObjectStore('scheduled', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}
