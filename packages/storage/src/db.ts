import { type IDBPDatabase, openDB } from 'idb';

// ─── Database ──────────────────────────────────────────────────────────

const DB_NAME = 'degenfeed';
const DB_VERSION = 3;

export let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

export async function getDb(): Promise<IDBPDatabase<unknown>> {
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
        // Bookmarks store
        if (!db.objectStoreNames.contains('bookmarks')) {
          const store = db.createObjectStore('bookmarks', {
            keyPath: 'postId',
          });
          store.createIndex('savedAt', 'savedAt');
        }
        // Monetization preferences store
        if (!db.objectStoreNames.contains('monetization')) {
          db.createObjectStore('monetization', {
            keyPath: 'identityId',
          });
        }
      },
    });
  }
  return dbPromise;
}
