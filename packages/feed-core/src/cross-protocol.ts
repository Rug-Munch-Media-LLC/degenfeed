/**
 * Cross-Protocol Threading
 *
 * Links threads across protocols so a conversation started on Mastodon
 * can have replies from Nostr, Bluesky, Farcaster, etc.
 *
 * Features:
 *   - Thread linking: maps replies across protocols to the same thread
 *   - "Also posted on" tracking: when a user posts to multiple protocols,
 *     we track the cross-posted note IDs
 *   - Cross-protocol reply trees: assemble replies from all protocols
 *     into a single unified thread
 *   - Bridge status tracking: track which protocols are bridged per thread
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Cross-Protocol Thread Types ────────────────────────────────────────

export interface CrossProtocolLink {
  /** Source protocol + post ID */
  sourceProtocol: string;
  sourceId: string;
  /** Target protocol + post ID (the cross-post) */
  targetProtocol: string;
  targetId: string;
  /** When the link was established */
  linkedAt: number;
  /** Verification status */
  verified: boolean;
  /** How the link was established */
  method: 'user' | 'bridge' | 'discovery' | 'api';
}

export interface CrossProtocolThread {
  /** Canonical thread ID (first post's ID) */
  threadId: string;
  /** The root post */
  rootPost: UnifiedPost;
  /** All replies, from all protocols, in chronological order */
  replies: CrossProtocolReply[];
  /** Which protocols have replies in this thread */
  protocols: string[];
  /** Count of bridged (cross-protocol) replies */
  bridgeCount: number;
  /** Per-protocol reply counts */
  byProtocol: Record<string, number>;
  /** Cross-post links (same content on different protocols) */
  crossPostLinks: CrossProtocolLink[];
  /** "Also posted on" — shows where else this post exists */
  alsoPostedOn: string[];
}

export interface CrossProtocolReply {
  id: string;
  protocol: string;
  text: string;
  createdAt: number;
  author: {
    id: string;
    displayName: string;
    handle?: string;
    avatarUrl?: string;
  };
  metrics: {
    likes: number;
    replies: number;
  };
  /** Whether this reply was bridged from another protocol */
  bridged: boolean;
  /** Which protocol it was bridged FROM (null if native) */
  bridgeFrom?: string;
  /** URI of the parent post */
  parentUri: string;
  /** Depth in the thread */
  depth: number;
  /** If this reply was cross-posted by the bridge */
  viaCrossPost?: boolean;
  /** Cross-post links for this specific reply */
  crossPostTo?: string[];
}

// ─── Thread Store (in-memory, production would use Redis/DB) ────────────

interface ThreadRecord {
  threadId: string;
  rootProtocol: string;
  rootId: string;
  replies: CrossProtocolReply[];
  crossPostLinks: CrossProtocolLink[];
  lastUpdated: number;
}

const threadStore = new Map<string, ThreadRecord>();

// ─── Cross-Post Linkage ─────────────────────────────────────────────────

/**
 * Register a cross-post link between two protocols.
 * When user posts the same content on Mastodon AND Nostr, this records the link.
 */
export function registerCrossPostLink(
  sourceProtocol: string,
  sourceId: string,
  targetProtocol: string,
  targetId: string,
  method: CrossProtocolLink['method'] = 'bridge',
): CrossProtocolLink {
  const link: CrossProtocolLink = {
    sourceProtocol,
    sourceId,
    targetProtocol,
    targetId,
    linkedAt: Date.now(),
    verified: method !== 'discovery',
    method,
  };

  // Find or create thread record
  const threadKey = `${sourceProtocol}:${sourceId}`;
  const existing = threadStore.get(threadKey);
  if (existing) {
    existing.crossPostLinks.push(link);
    existing.lastUpdated = Date.now();
  } else {
    threadStore.set(threadKey, {
      threadId: threadKey,
      rootProtocol: sourceProtocol,
      rootId: sourceId,
      replies: [],
      crossPostLinks: [link],
      lastUpdated: Date.now(),
    });
  }

  return link;
}

/**
 * Get all cross-post links for a given post.
 * Returns which other protocols this post has been cross-posted to.
 */
export function getCrossPostLinks(protocol: string, postId: string): CrossProtocolLink[] {
  const results: CrossProtocolLink[] = [];

  // Direct lookups
  const direct = threadStore.get(`${protocol}:${postId}`);
  if (direct) results.push(...direct.crossPostLinks);

  // Reverse lookups (when other protocols point to this one)
  for (const [, record] of threadStore) {
    const links = record.crossPostLinks.filter(
      (l) => l.targetProtocol === protocol && l.targetId === postId,
    );
    results.push(...links);
  }

  return results;
}

/**
 * Get which protocols a post has been cross-posted to.
 * Returns protocol names like ["nostr", "bluesky"].
 */
export function getAlsoPostedOn(protocol: string, postId: string): string[] {
  const links = getCrossPostLinks(protocol, postId);
  const protocols = new Set<string>();
  for (const link of links) {
    if (link.sourceProtocol === protocol && link.sourceId === postId) {
      protocols.add(link.targetProtocol);
    } else if (link.targetProtocol === protocol && link.targetId === postId) {
      protocols.add(link.sourceProtocol);
    }
  }
  return Array.from(protocols);
}

// ─── Thread Assembly ────────────────────────────────────────────────────

/**
 * Register a cross-protocol reply on a thread.
 * The reply may come from any protocol — we unify them here.
 */
export function registerReply(
  threadRootProtocol: string,
  threadRootId: string,
  reply: CrossProtocolReply,
): CrossProtocolThread {
  const threadKey = `${threadRootProtocol}:${threadRootId}`;

  let record = threadStore.get(threadKey);
  if (!record) {
    record = {
      threadId: threadKey,
      rootProtocol: threadRootProtocol,
      rootId: threadRootId,
      replies: [],
      crossPostLinks: [],
      lastUpdated: Date.now(),
    };
    threadStore.set(threadKey, record);
  }

  // Avoid duplicates
  const exists = record.replies.some((r) => r.id === reply.id);
  if (!exists) {
    record.replies.push(reply);
    record.lastUpdated = Date.now();
  }

  return buildThread(record);
}

/**
 * Build a CrossProtocolThread from a ThreadRecord.
 */
function buildThread(record: ThreadRecord): CrossProtocolThread {
  const sorted = [...record.replies].sort((a, b) => a.createdAt - b.createdAt);

  const protocols = new Set<string>();
  const byProtocol: Record<string, number> = {};
  let bridgeCount = 0;

  for (const r of sorted) {
    protocols.add(r.protocol);
    byProtocol[r.protocol] = (byProtocol[r.protocol] || 0) + 1;
    if (r.bridged) bridgeCount++;
  }

  const alsoPostedOn = new Set<string>();
  for (const link of record.crossPostLinks) {
    alsoPostedOn.add(link.targetProtocol);
    alsoPostedOn.add(link.sourceProtocol);
  }
  // Remove root protocol from "also posted on"
  alsoPostedOn.delete(record.rootProtocol);

  return {
    threadId: record.threadId,
    rootPost: {
      id: `${record.rootProtocol}:${record.rootId}`,
      protocol: record.rootProtocol,
      text: '',
      author: {
        id: '',
        primary: { protocol: record.rootProtocol, id: record.rootId },
        handles: {},
        displayName: '',
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      createdAt: 0,
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: {},
      niches: [],
    } as unknown as UnifiedPost,
    replies: sorted,
    protocols: Array.from(protocols),
    bridgeCount,
    byProtocol,
    crossPostLinks: record.crossPostLinks,
    alsoPostedOn: Array.from(alsoPostedOn),
  };
}

/**
 * Get a assembled thread for a post.
 */
export function getThread(protocol: string, postId: string): CrossProtocolThread | null {
  const record = threadStore.get(`${protocol}:${postId}`);
  if (!record) return null;
  return buildThread(record);
}

/**
 * Get thread metadata for a post (lightweight, no replies).
 */
export function getThreadMeta(
  protocol: string,
  postId: string,
): {
  protocolCount: number;
  replyCount: number;
  bridgeCount: number;
  alsoPostedOn: string[];
} | null {
  const record = threadStore.get(`${protocol}:${postId}`);
  if (!record) return null;

  const protocols = new Set(record.replies.map((r) => r.protocol));
  const alsoPostedOn = new Set<string>();
  for (const link of record.crossPostLinks) {
    alsoPostedOn.add(link.targetProtocol);
    alsoPostedOn.add(link.sourceProtocol);
  }
  alsoPostedOn.delete(protocol);

  return {
    protocolCount: protocols.size,
    replyCount: record.replies.length,
    bridgeCount: record.replies.filter((r) => r.bridged).length,
    alsoPostedOn: Array.from(alsoPostedOn),
  };
}

// ─── Reply Assembly from Multiple Protocols ─────────────────────────────

/**
 * Merge replies from multiple protocol providers into a unified thread.
 * In production, this would call each protocol's fetchReply API.
 */
export function assembleCrossProtocolReplies(
  rootProtocol: string,
  rootId: string,
  repliesByProtocol: Record<string, CrossProtocolReply[]>,
): CrossProtocolThread {
  const threadKey = `${rootProtocol}:${rootId}`;

  let record = threadStore.get(threadKey);
  if (!record) {
    record = {
      threadId: threadKey,
      rootProtocol,
      rootId,
      replies: [],
      crossPostLinks: [],
      lastUpdated: Date.now(),
    };
    threadStore.set(threadKey, record);
  }

  for (const [protocol, replies] of Object.entries(repliesByProtocol)) {
    for (const reply of replies) {
      const exists = record.replies.some((r) => r.id === reply.id);
      if (!exists) {
        // Mark as bridged if it's from a different protocol than root
        if (protocol !== rootProtocol) {
          reply.bridged = true;
          reply.bridgeFrom = protocol;
        }
        record.replies.push(reply);
      }
    }
  }

  record.lastUpdated = Date.now();
  return buildThread(record);
}

/**
 * Create a "Also posted on Nostr" indicator data.
 * Shows which other protocols a post appears on.
 */
export function buildAlsoPostedIndicator(
  protocol: string,
  postId: string,
): {
  show: boolean;
  protocols: Array<{ name: string; icon: string; url?: string }>;
} {
  const alsoPostedOn = getAlsoPostedOn(protocol, postId);

  if (alsoPostedOn.length === 0) {
    return { show: false, protocols: [] };
  }

  const protocolMeta: Record<string, { name: string; icon: string }> = {
    nostr: { name: 'Nostr', icon: '⚡' },
    farcaster: { name: 'Farcaster', icon: '📡' },
    bluesky: { name: 'Bluesky', icon: '🦋' },
    lens: { name: 'Lens', icon: '🔍' },
    mastodon: { name: 'Mastodon', icon: '🐘' },
    threads: { name: 'Threads', icon: '🧵' },
    lemmy: { name: 'Lemmy', icon: '🍋' },
    peertube: { name: 'PeerTube', icon: '🎬' },
    reddit: { name: 'Reddit', icon: '🤖' },
    rss: { name: 'RSS', icon: '📡' },
  };

  return {
    show: true,
    protocols: alsoPostedOn.map((p) => ({
      name: protocolMeta[p]?.name || p,
      icon: protocolMeta[p]?.icon || '🌐',
    })),
  };
}

// ─── Cleanup ────────────────────────────────────────────────────────────

/**
 * Clear thread store (for testing or periodic cleanup).
 */
export function clearThreadStore(): void {
  threadStore.clear();
}

/**
 * Remove threads older than the given age in ms.
 */
export function pruneThreads(olderThanMs: number): number {
  const cutoff = Date.now() - olderThanMs;
  let pruned = 0;
  for (const [key, record] of threadStore) {
    if (record.lastUpdated < cutoff) {
      threadStore.delete(key);
      pruned++;
    }
  }
  return pruned;
}
