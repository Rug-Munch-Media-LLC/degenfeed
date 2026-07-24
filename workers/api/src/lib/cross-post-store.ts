/**
 * @degenfeed/api-worker — Cross-Post KV Store
 *
 * Manages cross-post sibling relationships, reply aggregation tracking,
 * and content sync state across all supported protocols.
 *
 * Each post published to multiple protocols gets a "sibling map" stored
 * in KV so the unified thread view can pull replies from every protocol
 * the content was published to.
 *
 * Edit sync state tracks when a post is edited on one protocol so the
 * change can be propagated to all sibling copies.
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────

export interface CrosspostSibling {
  protocol: Protocol;
  nativeId: string;
  /** Timestamp of the original publish (ms) */
  publishedAt: number;
  /** URI on this protocol (e.g. at://, nostr:note1...) */
  nativeUri?: string;
}

export interface CrosspostMap {
  /** The "canonical" df:// URI that started the cross-post */
  rootUri: string;
  /** Root protocol (the origin) */
  rootProtocol: Protocol;
  /** Root nativeId on the origin protocol */
  rootNativeId: string;
  /** All sibling copies across protocols */
  siblings: CrosspostSibling[];
  /** Number of protocols successfully published to */
  protocolCount: number;
  /** When the cross-post was first published (ms) */
  createdAt: number;
  /** When the cross-post was last updated (ms) */
  updatedAt: number;
}

export interface ReplyAggregation {
  /** df:// URI of the post being aggregated */
  postUri: string;
  /** Per-protocol reply counts */
  byProtocol: Record<string, number>;
  /** Total replies across all protocols */
  total: number;
  /** Last time this aggregation was refreshed (ms) */
  lastRefreshed: number;
}

export interface EditSyncEntry {
  /** df:// URI of the edited post */
  editedUri: string;
  /** Protocol where the edit originated */
  sourceProtocol: Protocol;
  /** New text content */
  newText: string;
  /** New title (if changed) */
  newTitle?: string;
  /** Timestamp of the edit (ms) */
  editedAt: number;
  /** Timestamp of the last update (ms) */
  updatedAt: number;
  /** Whether the sync has been propagated to all siblings */
  fullySynced: boolean;
  /** Per-protocol sync status */
  syncStatus: Record<string, 'pending' | 'synced' | 'failed' | 'skipped'>;
}

// ─── KV Key Constants ─────────────────────────────────────────────────────

const CROSSPOST_PREFIX = 'crosspost:';
const REPLY_AGG_PREFIX = 'reply-agg:';
const EDIT_SYNC_PREFIX = 'edit-sync:';
const SIBLING_INDEX_PREFIX = 'sibling-index:';
const CROSSPOST_TTL = 86400 * 30; // 30 days
const REPLY_AGG_TTL = 86400 * 7; // 7 days

// ─── Crosspost Sibling Map ────────────────────────────────────────────────

/**
 * Store a cross-post sibling map after publishing to multiple protocols.
 * Creates one entry per protocol so the thread view can find siblings
 * from any of the published copies.
 */
export async function storeCrosspostMap(
  env: Env,
  rootProtocol: Protocol,
  rootNativeId: string,
  results: Record<string, { success?: boolean; ok?: boolean; error?: string; hash?: string }>,
): Promise<CrosspostMap | null> {
  if (!env.CACHE) return null;

  const rootUri = `df://${rootProtocol}:${rootNativeId}`;
  const published = Object.entries(results).filter(
    ([protocol, r]) =>
      (r.success || r.ok) &&
      r.hash &&
      protocol !== rootProtocol &&
      ALLOWED_PROTOCOLS_FOR_CROSSPOST.has(protocol),
  );

  if (published.length === 0) return null;

  const now = Date.now();
  const siblings: CrosspostSibling[] = published.map(([protocol, r]) => ({
    protocol: protocol as Protocol,
    nativeId: r.hash as string,
    publishedAt: now,
  }));

  const map: CrosspostMap = {
    rootUri,
    rootProtocol,
    rootNativeId,
    siblings,
    protocolCount: 1 + siblings.length,
    createdAt: now,
    updatedAt: now,
  };

  // Store under root URI
  await env.CACHE.put(`${CROSSPOST_PREFIX}${rootUri}`, JSON.stringify(map), {
    expirationTtl: CROSSPOST_TTL,
  });

  // Also store under each sibling's URI so the thread view finds it
  for (const sibling of siblings) {
    const siblingUri = `df://${sibling.protocol}:${sibling.nativeId}`;
    await env.CACHE.put(`${CROSSPOST_PREFIX}${siblingUri}`, JSON.stringify(map), {
      expirationTtl: CROSSPOST_TTL,
    });
  }

  return map;
}

/**
 * Retrieve the crosspost sibling map for a given df:// URI.
 */
export async function getCrosspostMap(env: Env, dfUri: string): Promise<CrosspostMap | null> {
  if (!env.CACHE) return null;
  try {
    const raw = (await env.CACHE.get(`${CROSSPOST_PREFIX}${dfUri}`, 'json')) as CrosspostMap | null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Get all sibling URIs (excluding the given one).
 */
export async function getSiblingUris(
  env: Env,
  dfUri: string,
): Promise<{ protocol: Protocol; nativeId: string; nativeUri?: string }[]> {
  const map = await getCrosspostMap(env, dfUri);
  if (!map) return [];
  return map.siblings;
}

// ─── Reply Aggregation ────────────────────────────────────────────────────

/**
 * Store reply aggregation data for a post after polling all protocols.
 */
export async function storeReplyAggregation(
  env: Env,
  postUri: string,
  byProtocol: Record<string, number>,
): Promise<void> {
  if (!env.CACHE) return;

  const total = Object.values(byProtocol).reduce((sum, count) => sum + count, 0);
  const agg: ReplyAggregation = {
    postUri,
    byProtocol,
    total,
    lastRefreshed: Date.now(),
  };

  await env.CACHE.put(`${REPLY_AGG_PREFIX}${postUri}`, JSON.stringify(agg), {
    expirationTtl: REPLY_AGG_TTL,
  });
}

/**
 * Get cached reply aggregation for a post.
 */
export async function getReplyAggregation(
  env: Env,
  postUri: string,
): Promise<ReplyAggregation | null> {
  if (!env.CACHE) return null;
  try {
    return (await env.CACHE.get(
      `${REPLY_AGG_PREFIX}${postUri}`,
      'json',
    )) as ReplyAggregation | null;
  } catch {
    return null;
  }
}

// ─── Edit Sync ────────────────────────────────────────────────────────────

/**
 * Record an edit that needs to be synced to sibling protocols.
 */
export async function recordEditSync(
  env: Env,
  sourceProtocol: Protocol,
  nativeId: string,
  newText: string,
  newTitle?: string,
): Promise<EditSyncEntry | null> {
  if (!env.CACHE) return null;

  const editedUri = `df://${sourceProtocol}:${nativeId}`;
  const map = await getCrosspostMap(env, editedUri);
  if (!map) return null;

  // Initialize sync status for all siblings
  const syncStatus: Record<string, 'pending' | 'synced' | 'failed' | 'skipped'> = {};
  for (const sibling of map.siblings) {
    syncStatus[sibling.protocol] = 'pending';
  }

  const entry: EditSyncEntry = {
    editedUri,
    sourceProtocol,
    newText,
    newTitle,
    editedAt: Date.now(),
    fullySynced: false,
    syncStatus,
    updatedAt: Date.now(),
  };

  await env.CACHE.put(`${EDIT_SYNC_PREFIX}${editedUri}`, JSON.stringify(entry), {
    expirationTtl: 86400 * 7, // 7 days to sync
  });

  return entry;
}

/**
 * Get pending edit sync entries.
 */
export async function getEditSyncEntry(env: Env, dfUri: string): Promise<EditSyncEntry | null> {
  if (!env.CACHE) return null;
  try {
    return (await env.CACHE.get(`${EDIT_SYNC_PREFIX}${dfUri}`, 'json')) as EditSyncEntry | null;
  } catch {
    return null;
  }
}

/**
 * Update sync status for a specific protocol in an edit sync entry.
 */
export async function updateEditSyncStatus(
  env: Env,
  dfUri: string,
  protocol: string,
  status: 'synced' | 'failed' | 'skipped',
): Promise<void> {
  if (!env.CACHE) return;

  const entry = await getEditSyncEntry(env, dfUri);
  if (!entry) return;

  entry.syncStatus[protocol] = status;

  // Check if all siblings are done
  const allDone = Object.values(entry.syncStatus).every((s) => s === 'synced' || s === 'skipped');
  if (allDone) {
    entry.fullySynced = true;
  }

  entry.updatedAt = Date.now();

  await env.CACHE.put(`${EDIT_SYNC_PREFIX}${dfUri}`, JSON.stringify(entry), {
    expirationTtl: 86400 * 7,
  });
}

/**
 * Get all pending edit syncs (those not yet fully synced).
 */
export async function getPendingEditSyncs(env: Env): Promise<EditSyncEntry[]> {
  if (!env.CACHE) return [];
  const pending: EditSyncEntry[] = [];

  try {
    let cursor: string | undefined;
    do {
      const page: {
        keys: { name: string }[];
        list_complete: boolean;
        cursor?: string;
      } = await env.CACHE.list({
        prefix: EDIT_SYNC_PREFIX,
        cursor,
        limit: 100,
      });

      for (const key of page.keys) {
        const entry = (await env.CACHE.get(key.name, 'json')) as EditSyncEntry | null;
        if (entry && !entry.fullySynced) {
          pending.push(entry);
        }
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) {
    console.error('[cross-post-store] Failed to list pending edit syncs:', e);
  }

  return pending;
}

// ─── Allowed protocols for cross-posting ──────────────────────────────────

const ALLOWED_PROTOCOLS_FOR_CROSSPOST = new Set([
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'threads',
  'telegram',
  'rss',
]);

// ─── Sibling Index ────────────────────────────────────────────────────────

/**
 * Store a quick-lookup index for sibling relationships.
 *
 * Key format: `sibling-index:{rootProtocol}:{rootNativeId}`
 * Value: JSON array of sibling protocols
 */
export async function indexSiblingProtocols(
  env: Env,
  rootProtocol: Protocol,
  rootNativeId: string,
  siblingProtocols: Protocol[],
): Promise<void> {
  if (!env.CACHE) return;

  const key = `${SIBLING_INDEX_PREFIX}${rootProtocol}:${rootNativeId}`;
  await env.CACHE.put(key, JSON.stringify(siblingProtocols), {
    expirationTtl: CROSSPOST_TTL,
  });
}

/**
 * Get the sibling protocols for a given post.
 */
export async function getSiblingProtocols(
  env: Env,
  protocol: Protocol,
  nativeId: string,
): Promise<Protocol[]> {
  if (!env.CACHE) return [];
  try {
    const key = `${SIBLING_INDEX_PREFIX}${protocol}:${nativeId}`;
    const raw = await env.CACHE.get(key, 'json');
    return (raw as Protocol[]) ?? [];
  } catch {
    return [];
  }
}

// ─── Cross-post record (legacy support for thread.ts) ─────────────────────

/**
 * Record cross-post siblings in the legacy format used by thread.ts.
 * This is called from the publish orchestrator after a multi-target publish.
 *
 * @deprecated Use storeCrosspostMap instead. Kept for backward compat.
 */
export async function recordCrosspostSiblingsLegacy(
  env: Env,
  rootProtocol: Protocol,
  rootNativeId: string,
  results: Record<string, { success?: boolean; ok?: boolean; error?: string; hash?: string }>,
): Promise<void> {
  const map = await storeCrosspostMap(env, rootProtocol, rootNativeId, results);
  if (!map) return;

  // Also write the legacy `crosspost:` keys that thread.ts expects
  const published = Object.entries(results).filter(
    ([protocol, r]) =>
      (r.success || r.ok) && r.hash && ALLOWED_PROTOCOLS_FOR_CROSSPOST.has(protocol),
  );

  const siblings = published.map(([protocol, r]) => ({
    protocol,
    nativeId: r.hash as string,
  }));

  for (const [protocol, r] of published) {
    const key = `crosspost:df://${protocol}:${r.hash}`;
    try {
      await env.CACHE?.put(key, JSON.stringify(siblings), {
        expirationTtl: CROSSPOST_TTL,
      });
    } catch (e) {
      console.error('[cross-post-store] Legacy sibling write failed:', e);
    }
  }
}
