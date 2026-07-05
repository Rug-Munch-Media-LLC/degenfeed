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

// ─── Database ──────────────────────────────────────────────────────────

const DB_NAME = 'degenfeed';
const DB_VERSION = 1;

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
      },
    });
  }
  return dbPromise;
}

