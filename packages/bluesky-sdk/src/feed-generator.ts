/**
 * @degenfeed/bluesky-sdk — Bluesky Feed Generator for Live Content
 *
 * Implements the AT Protocol feed generator interface (app.bsky.feed.getFeedSkeleton)
 * for the "DegenFeed Live" custom feed, showing live streams and spaces.
 *
 * Feed Generator Identity:
 *   DID:    did:web:live.degenfeed.xyz
 *   Handle: @live.degenfeed.xyz  (or via domain handle)
 *   Display Name: "DegenFeed Live"
 *   Description: "Live streams and spaces on DegenFeed — crypto, web3, defi, and more"
 *
 * AT Protocol Feed Generator Spec:
 *   https://atproto.com/guides/feed-generators
 *
 * The feed generator publishes a DID document at
 *   /.well-known/did.json  →  did:web:live.degenfeed.xyz
 * so that Bluesky clients can discover it.
 *
 * When a stream goes live, its announcement post URI is added to the feed.
 * When a stream ends, the post is removed from the feed's skeleton.
 */

/**
 * KV store interface — adapts to Cloudflare Workers KV or any key-value store
 * with get/put/delete methods.
 */
export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface FeedGeneratorDescription {
  did: string;
  handle?: string;
  displayName: string;
  description: string;
  avatar?: string;
  /** UTC timestamp of last feed update (ISO 8601) */
  updatedAt: string;
}

export interface FeedSkeleton {
  feed: Array<{ post: string }>;
  cursor?: string;
}

export interface FeedGeneratorDeclaration {
  did: string;
  service: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  alsoKnownAs?: string[];
}

export interface LiveFeedItem {
  /** AT Protocol URI of the announcement post (at://did/app.bsky.feed.post/rkey) */
  postUri: string;
  /** Stream ID for removal on stream end */
  streamId: string;
  /** When the stream started (Unix ms) */
  startedAt: number;
  /** Current viewer count (for ranking) */
  viewerCount: number;
  /** Whether the stream is still live */
  isLive: boolean;
}

// ─── Feed Generator DID + Config ──────────────────────────────────────────

export const FEED_GENERATOR_DID = 'did:web:live.degenfeed.xyz';
export const FEED_GENERATOR_HANDLE = 'live.degenfeed.xyz';
export const FEED_GENERATOR_DISPLAY_NAME = 'DegenFeed Live';
export const FEED_GENERATOR_DESCRIPTION =
  'Live streams and spaces on DegenFeed — crypto, web3, defi, and more';

/**
 * Build the DID document for the feed generator.
 * This should be served at /.well-known/did.json on the feed generator domain.
 */
export function buildFeedGeneratorDidDoc(): FeedGeneratorDeclaration {
  return {
    did: FEED_GENERATOR_DID,
    service: [
      {
        id: '#bsky_fg',
        type: 'BskyFeedGenerator',
        serviceEndpoint: 'https://app.degenfeed.xyz/api/bsky-feed',
      },
    ],
    alsoKnownAs: [`at://${FEED_GENERATOR_HANDLE}`],
  };
}

/**
 * Return the feed generator description (app.bsky.feed.describeFeedGenerator).
 */
export function describeFeedGenerator(): FeedGeneratorDescription {
  return {
    did: FEED_GENERATOR_DID,
    handle: FEED_GENERATOR_HANDLE,
    displayName: FEED_GENERATOR_DISPLAY_NAME,
    description: FEED_GENERATOR_DESCRIPTION,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Live Feed Generator ──────────────────────────────────────────────────

export class LiveFeedGenerator {
  private kv: KVStore;

  constructor(kv: KVStore) {
    this.kv = kv;
  }

  /**
   * Return the feed skeleton for the "DegenFeed Live" feed.
   *
   * Called by the Bluesky feed generator endpoint (app.bsky.feed.getFeedSkeleton).
   * Returns live stream announcement posts sorted by viewer count (most popular first).
   */
  async getFeedSkeleton(
    limit: number = 50,
    cursor?: string,
  ): Promise<FeedSkeleton> {
    const items = await this.getFeedItems();

    // Filter out ended streams
    const liveItems = items.filter((item) => item.isLive);

    // Sort: most viewers first, then most recent
    liveItems.sort((a, b) => {
      if (b.viewerCount !== a.viewerCount) {
        return b.viewerCount - a.viewerCount;
      }
      return b.startedAt - a.startedAt;
    });

    // Handle pagination cursor (stream ID-based)
    let startIndex = 0;
    if (cursor) {
      const cursorIdx = liveItems.findIndex((item) => item.streamId === cursor);
      if (cursorIdx >= 0) {
        startIndex = cursorIdx + 1;
      }
    }

    const page = liveItems.slice(startIndex, startIndex + limit);
    const nextCursor =
      page.length === limit
        ? page[page.length - 1]?.streamId
        : undefined;

    return {
      feed: page.map((item) => ({ post: item.postUri })),
      cursor: nextCursor,
    };
  }

  /**
   * When a stream goes live, add its announcement post to the feed.
   */
  async addToLiveFeed(blueskyPostUri: string, streamId: string): Promise<void> {
    const items = await this.getFeedItems();

    // Avoid duplicates
    if (items.some((item) => item.streamId === streamId)) return;

    items.unshift({
      postUri: blueskyPostUri,
      streamId,
      startedAt: Date.now(),
      viewerCount: 0,
      isLive: true,
    });

    await this.storeFeedItems(items);
  }

  /**
   * When a stream ends, remove from feed so it no longer appears.
   */
  async removeFromLiveFeed(blueskyPostUri?: string, streamId?: string): Promise<void> {
    const items = await this.getFeedItems();
    const filtered = items.filter((item) => {
      if (blueskyPostUri && item.postUri === blueskyPostUri) return false;
      if (streamId && item.streamId === streamId) return false;
      return item.isLive; // Keep items that are still live
    });

    await this.storeFeedItems(filtered);
  }

  /**
   * Update viewer count for a live stream in the feed.
   */
  async updateViewerCount(streamId: string, count: number): Promise<void> {
    const items = await this.getFeedItems();
    const item = items.find((i) => i.streamId === streamId);
    if (item) {
      item.viewerCount = count;
      await this.storeFeedItems(items);
    }
  }

  /**
   * Get all current feed items from KV.
   */
  private async getFeedItems(): Promise<LiveFeedItem[]> {
    try {
      const raw = await this.kv.get('bsky:live-feed:items');
      if (!raw) return [];
      return JSON.parse(raw) as LiveFeedItem[];
    } catch {
      return [];
    }
  }

  /**
   * Store feed items in KV with 7-day TTL.
   */
  private async storeFeedItems(items: LiveFeedItem[]): Promise<void> {
    // Cap at 500 items
    const trimmed = items.slice(0, 500);
    await this.kv.put(
      'bsky:live-feed:items',
      JSON.stringify(trimmed),
      { expirationTtl: 86400 * 7 },
    ).catch(() => {});
  }
}
