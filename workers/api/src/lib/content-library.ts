/**
 * @degenfeed/api-worker — Unified Content Library
 *
 * KV-backed content library for each creator. Every post/video/short published
 * through DegenFeed is stored here, creating a permanent content catalog that
 * spans all protocols.
 *
 * KV key scheme:
 *   cl:{wallet}:{contentId}  → ContentRecord (full record, no TTL)
 *   cl:idx:{wallet}           → JSON array of { id, type, title, createdAt, updatedAt }
 *   cl:idx:{wallet}:{type}    → JSON array of { id, title, createdAt } (per-type index)
 *
 * The library is append-only: content is never truly deleted, only soft-deleted
 * (via a `deleted` flag in the record).
 */

import type { Env } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MediaAttachment {
  url: string;
  mimeType: string;
  alt?: string;
  width?: number;
  height?: number;
  /** IPFS / Arweave / Storj CID for permanence */
  cid?: string;
}

export interface ProtocolEngagement {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  views: number;
  /** Timestamp of last engagement pull (ms) */
  lastSyncedAt: number;
}

export interface ProtocolCopy {
  status: 'published' | 'failed' | 'pending' | 'scheduled';
  postId: string;
  url: string;
  publishedAt: number;
  engagement: ProtocolEngagement;
  /** The protocol-specific canonical URI */
  nativeUri?: string;
}

export type ContentType = 'post' | 'video' | 'short' | 'article' | 'stream';
export type LicenseType = 'all-rights' | 'cc-by' | 'cc-by-sa' | 'cc-by-nc' | 'cc0' | 'custom';

export interface ContentRecord {
  id: string;
  creatorWallet: string;
  type: ContentType;
  title?: string;
  body: string;
  media: MediaAttachment[];
  /** Per-protocol publish results */
  protocols: Record<string, ProtocolCopy>;
  tags: string[];
  niches: string[];
  license: LicenseType;
  /** Raw license text for 'custom' license type */
  customLicenseText?: string;
  /** Cross-platform threading: all df:// URIs that are this content */
  siblingUris: string[];
  /** Source content if imported (e.g., imported from YouTube, Medium) */
  importSource?: {
    platform: string;
    externalId: string;
    url: string;
    importedAt: number;
  };
  /** Monetization configuration */
  monetization?: {
    type: 'token-gate' | 'pay-per-view' | 'free-with-tipping';
    tokenAddress?: string;
    minTokens?: string;
    price?: string;
    priceToken?: string;
  };
  /** Platform permissions: which protocols can this appear on? */
  platformPermissions?: {
    allowedProtocols: string[];
    canBeCrossPosted: boolean;
    requireAttribution: boolean;
  };
  /** Soft-delete flag */
  deleted?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ContentIndexEntry {
  id: string;
  type: ContentType;
  title?: string;
  createdAt: number;
  updatedAt: number;
  /** Count of successfully published protocols */
  protocolCount: number;
  /** Total engagement across all protocols */
  totalEngagement: number;
}

// ─── KV Helpers ─────────────────────────────────────────────────────────────

// biome-ignore lint/style/noNonNullAssertion: KV namespace is always bound in production via wrangler.toml
function kv(env: Env): KVNamespace {
  return env.CONTENT_LIBRARY || env.CACHE!;
}

function contentKey(wallet: string, contentId: string): string {
  return `cl:${wallet.toLowerCase()}:${contentId}`;
}

function indexKey(wallet: string): string {
  return `cl:idx:${wallet.toLowerCase()}`;
}

function typeIndexKey(wallet: string, type: string): string {
  return `cl:idx:${wallet.toLowerCase()}:${type}`;
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/**
 * Store a content record in the creator's library.
 * Updates both the full record and the index.
 */
export async function storeContent(
  env: Env,
  wallet: string,
  record: ContentRecord,
): Promise<ContentRecord> {
  const store = kv(env);
  const key = contentKey(wallet, record.id);
  const now = Date.now();

  // Ensure timestamps
  if (!record.createdAt) record.createdAt = now;
  record.updatedAt = now;

  await store.put(key, JSON.stringify(record));

  // Update the master index
  await updateIndex(env, wallet, record);

  // Update per-type index
  await updateTypeIndex(env, wallet, record);

  return record;
}

/**
 * Get a single content record by ID.
 * Returns null if not found or soft-deleted (when includeDeleted is false).
 */
export async function getContent(
  env: Env,
  wallet: string,
  contentId: string,
  includeDeleted = false,
): Promise<ContentRecord | null> {
  const store = kv(env);
  const key = contentKey(wallet, contentId);

  try {
    const raw = await store.get(key);
    if (!raw) return null;

    const record = JSON.parse(raw) as ContentRecord;
    if (!includeDeleted && record.deleted) return null;

    return record;
  } catch {
    return null;
  }
}

/**
 * Update an existing content record.
 * Merges the partial update with the existing record.
 */
export async function updateContent(
  env: Env,
  wallet: string,
  contentId: string,
  updates: Partial<ContentRecord>,
): Promise<ContentRecord | null> {
  const existing = await getContent(env, wallet, contentId, true);
  if (!existing) return null;

  const updated: ContentRecord = {
    ...existing,
    ...updates,
    id: existing.id,
    creatorWallet: existing.creatorWallet,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };

  return storeContent(env, wallet, updated);
}

/**
 * Soft-delete a content record.
 * Optionally also removes from protocols (when removeFromProtocols is true).
 */
export async function deleteContent(
  env: Env,
  wallet: string,
  contentId: string,
  removeFromProtocols = false,
): Promise<boolean> {
  const existing = await getContent(env, wallet, contentId, true);
  if (!existing) return false;

  // Soft-delete
  existing.deleted = true;
  existing.updatedAt = Date.now();

  const store = kv(env);
  const key = contentKey(wallet, contentId);
  await store.put(key, JSON.stringify(existing));

  // Remove from indices
  await removeFromIndex(env, wallet, contentId);
  await removeFromTypeIndex(env, wallet, existing.type, contentId);

  // Optionally delete from protocols
  if (removeFromProtocols) {
    await deleteFromProtocols(env, existing);
  }

  return true;
}

/**
 * List all content for a wallet with filtering and pagination.
 */
export async function listContent(
  env: Env,
  wallet: string,
  options: {
    type?: ContentType;
    protocol?: string;
    dateFrom?: number;
    dateTo?: number;
    cursor?: string;
    limit?: number;
    includeDeleted?: boolean;
    sort?: 'newest' | 'oldest' | 'engagement' | 'updated';
  } = {},
): Promise<{
  items: ContentRecord[];
  nextCursor: string | null;
  total: number;
}> {
  const store = kv(env);
  const limit = Math.min(options.limit || 50, 100);
  const walletLower = wallet.toLowerCase();

  // If filtering by type, use the type index
  if (options.type) {
    return listContentByType(env, walletLower, options.type, options);
  }

  // Read the index
  const indexRaw = await store.get(indexKey(walletLower));
  const index: ContentIndexEntry[] = indexRaw ? JSON.parse(indexRaw) : [];

  let items = index.map((entry) => entry as unknown as ContentIndexEntry);

  // Apply filter: protocol
  if (options.protocol) {
    const protocolItems: ContentRecord[] = [];
    for (const entry of items) {
      const record = await getContent(env, walletLower, entry.id, options.includeDeleted);
      if (record?.protocols[options.protocol!]) {
        protocolItems.push(record);
      }
    }
    items = protocolItems.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      protocolCount: Object.keys(r.protocols).length,
      totalEngagement: calcTotalEngagement(r),
    }));
  }

  // Apply date filter
  if (options.dateFrom) {
    items = items.filter((e) => e.createdAt >= options.dateFrom!);
  }
  if (options.dateTo) {
    items = items.filter((e) => e.createdAt <= options.dateTo!);
  }

  // Sort
  if (options.sort === 'oldest') {
    items.sort((a, b) => a.createdAt - b.createdAt);
  } else if (options.sort === 'engagement') {
    items.sort((a, b) => b.totalEngagement - a.totalEngagement);
  } else if (options.sort === 'updated') {
    items.sort((a, b) => b.updatedAt - a.updatedAt);
  } else {
    // Default: newest
    items.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Paginate (cursor-based using createdAt)
  const cursor = options.cursor ? parseInt(options.cursor, 36) : 0;
  if (cursor > 0) {
    items = items.filter((e) => e.createdAt < cursor);
  }

  const total = items.length;
  const page = items.slice(0, limit);
  const hasMore = items.length > limit;
  const nextCursor = hasMore
    ? (items[limit - 1] as ContentIndexEntry).createdAt.toString(36)
    : null;

  // Hydrate full records
  const records: ContentRecord[] = [];
  for (const entry of page) {
    const record = await getContent(env, walletLower, entry.id, options.includeDeleted);
    if (record) records.push(record);
  }

  return { items: records, nextCursor, total };
}

/**
 * List content filtered by type using the type-specific index.
 */
async function listContentByType(
  env: Env,
  wallet: string,
  type: ContentType,
  options: {
    cursor?: string;
    limit?: number;
    sort?: 'newest' | 'oldest' | 'engagement' | 'updated';
  },
): Promise<{ items: ContentRecord[]; nextCursor: string | null; total: number }> {
  const store = kv(env);
  const limit = options.limit || 50;
  const indexRaw = await store.get(typeIndexKey(wallet, type));
  const index: ContentIndexEntry[] = indexRaw ? JSON.parse(indexRaw) : [];

  // Sort
  if (options.sort === 'oldest') {
    index.sort((a, b) => a.createdAt - b.createdAt);
  } else {
    index.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Paginate
  const cursor = options.cursor ? parseInt(options.cursor, 36) : 0;
  const filtered = cursor > 0 ? index.filter((e) => e.createdAt < cursor) : index;
  const total = filtered.length;
  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const nextCursor = hasMore
    ? (filtered[limit - 1] as ContentIndexEntry).createdAt.toString(36)
    : null;

  // Hydrate
  const records: ContentRecord[] = [];
  for (const entry of page) {
    const record = await getContent(env, wallet, entry.id);
    if (record) records.push(record);
  }

  return { items: records, nextCursor, total };
}

// ─── Engagement / Sync ──────────────────────────────────────────────────────

/**
 * Sync engagement metrics from all protocols for a given content item.
 * Returns the updated record.
 */
export async function syncEngagement(
  env: Env,
  wallet: string,
  contentId: string,
): Promise<ContentRecord | null> {
  const record = await getContent(env, wallet, contentId);
  if (!record) return null;

  for (const [protocol, copy] of Object.entries(record.protocols)) {
    if (copy.status !== 'published') continue;
    if (!copy.postId) continue;

    try {
      const metrics = await fetchEngagementFromProtocol(env, protocol, copy.postId);
      if (metrics) {
        copy.engagement = metrics;
        copy.engagement.lastSyncedAt = Date.now();
      }
    } catch {
      // Silently skip if protocol unreachable
    }
  }

  record.updatedAt = Date.now();
  const store = kv(env);
  await store.put(contentKey(wallet, contentId), JSON.stringify(record));

  return record;
}

/**
 * Fetch engagement metrics from a specific protocol.
 * Each protocol has a separate endpoint or provider for post engagement.
 */
async function fetchEngagementFromProtocol(
  env: Env,
  protocol: string,
  postId: string,
): Promise<ProtocolEngagement | null> {
  const now = Date.now();

  switch (protocol) {
    case 'nostr': {
      // Nostr: query relay for kind 7 (reactions) and kind 6 (reposts)
      try {
        const res = await fetch(`https://api.nostr.wine/engagement?eventId=${postId}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            likes?: number;
            reposts?: number;
            replies?: number;
            views?: number;
          };
          return {
            likes: data.likes ?? 0,
            reposts: data.reposts ?? 0,
            replies: data.replies ?? 0,
            quotes: 0,
            views: data.views ?? 0,
            lastSyncedAt: now,
          };
        }
      } catch {
        // Fallback to generic
      }
      return { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0, lastSyncedAt: now };
    }

    case 'farcaster': {
      try {
        const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
        const res = await fetch(`${hubUrl}/v1/castById?fid=0&hash=${postId}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            reactions?: { likes_count?: number; recasts_count?: number; replies_count?: number };
          };
          return {
            likes: data.reactions?.likes_count ?? 0,
            reposts: data.reactions?.recasts_count ?? 0,
            replies: data.reactions?.replies_count ?? 0,
            quotes: 0,
            views: 0,
            lastSyncedAt: now,
          };
        }
      } catch {
        // fallback
      }
      return { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0, lastSyncedAt: now };
    }

    case 'bluesky': {
      try {
        const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
        const res = await fetch(
          `${pdsUrl}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postId)}&depth=0`,
          {
            signal: AbortSignal.timeout(3000),
          },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            thread?: { post?: { likeCount?: number; repostCount?: number; replyCount?: number } };
          };
          const post = data.thread?.post;
          return {
            likes: post?.likeCount ?? 0,
            reposts: post?.repostCount ?? 0,
            replies: post?.replyCount ?? 0,
            quotes: 0,
            views: 0,
            lastSyncedAt: now,
          };
        }
      } catch {
        // fallback
      }
      return { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0, lastSyncedAt: now };
    }

    default:
      // Generic: return zero metrics — protocol-specific integration needed
      return { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0, lastSyncedAt: now };
  }
}

// ─── Internal Index Management ─────────────────────────────────────────────

async function updateIndex(env: Env, wallet: string, record: ContentRecord): Promise<void> {
  const store = kv(env);
  const key = indexKey(wallet);

  try {
    const raw = await store.get(key);
    const index: ContentIndexEntry[] = raw ? JSON.parse(raw) : [];

    const existingIdx = index.findIndex((e) => e.id === record.id);
    const entry: ContentIndexEntry = {
      id: record.id,
      type: record.type,
      title: record.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      protocolCount: Object.keys(record.protocols).length,
      totalEngagement: calcTotalEngagement(record),
    };

    if (existingIdx >= 0) {
      index[existingIdx] = entry;
    } else {
      index.push(entry);
    }

    // Keep max 1000 entries per wallet index
    const trimmed = index.slice(-1000);
    await store.put(key, JSON.stringify(trimmed));
  } catch {
    // Index update failure is non-critical
  }
}

async function updateTypeIndex(env: Env, wallet: string, record: ContentRecord): Promise<void> {
  const store = kv(env);
  const key = typeIndexKey(wallet, record.type);

  try {
    const raw = await store.get(key);
    const index: ContentIndexEntry[] = raw ? JSON.parse(raw) : [];

    const existingIdx = index.findIndex((e) => e.id === record.id);
    const entry: ContentIndexEntry = {
      id: record.id,
      type: record.type,
      title: record.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      protocolCount: Object.keys(record.protocols).length,
      totalEngagement: calcTotalEngagement(record),
    };

    if (existingIdx >= 0) {
      index[existingIdx] = entry;
    } else {
      index.push(entry);
    }

    const trimmed = index.slice(-500);
    await store.put(key, JSON.stringify(trimmed));
  } catch {
    // non-critical
  }
}

async function removeFromIndex(env: Env, wallet: string, contentId: string): Promise<void> {
  const store = kv(env);
  const key = indexKey(wallet);

  try {
    const raw = await store.get(key);
    if (!raw) return;
    const index: ContentIndexEntry[] = JSON.parse(raw);
    const filtered = index.filter((e) => e.id !== contentId);
    await store.put(key, JSON.stringify(filtered));
  } catch {
    // non-critical
  }
}

async function removeFromTypeIndex(
  env: Env,
  wallet: string,
  type: string,
  contentId: string,
): Promise<void> {
  const store = kv(env);
  const key = typeIndexKey(wallet, type);

  try {
    const raw = await store.get(key);
    if (!raw) return;
    const index: ContentIndexEntry[] = JSON.parse(raw);
    const filtered = index.filter((e) => e.id !== contentId);
    await store.put(key, JSON.stringify(filtered));
  } catch {
    // non-critical
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcTotalEngagement(record: ContentRecord): number {
  let total = 0;
  for (const copy of Object.values(record.protocols)) {
    total += copy.engagement.likes;
    total += copy.engagement.reposts;
    total += copy.engagement.replies;
    total += copy.engagement.quotes;
    total += copy.engagement.views;
  }
  return total;
}

/**
 * Delete content from protocols (best-effort).
 */
async function deleteFromProtocols(env: Env, record: ContentRecord): Promise<void> {
  for (const [protocol, copy] of Object.entries(record.protocols)) {
    if (copy.status !== 'published' || !copy.postId) continue;

    try {
      switch (protocol) {
        case 'nostr': {
          // Nostr can't delete events — we can publish a kind 5 deletion event
          const nsec = env.NOSTR_BOT_NSEC || env.NOSTR_PRIVATE_KEY;
          if (nsec) {
            const nostr = await import('@degenfeed/nostr-sdk');
            const reason = 'Content removed from DegenFeed';
            const ev = nostr.createDeletion([copy.postId], reason, nsec);
            const pool = new nostr.RelayPool(
              (env.RELAY_URLS || 'wss://relay.damus.io').split(',').map((u) => u.trim()),
            );
            await pool.publish(ev);
            pool.disconnectAll();
          }
          break;
        }
        case 'farcaster': {
          // Farcaster doesn't support deletion via API directly
          break;
        }
        default:
          break;
      }
    } catch {
      // Best-effort deletion
    }
  }
}

/**
 * Generate a unique content ID.
 */
export function generateContentId(wallet: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const walletPrefix = wallet.slice(2, 8).toLowerCase();
  return `${ts}-${rand}-${walletPrefix}`;
}
