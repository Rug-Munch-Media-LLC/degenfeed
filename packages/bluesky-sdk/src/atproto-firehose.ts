/**
 * @degenfeed/bluesky-sdk — AT Protocol Firehose Content Discovery
 *
 * Cross-app content discovery over the AT Protocol firehose.
 * Pulls content from Bluesky posts, WhiteWind articles, Frontpage links,
 * and all other AT Protocol apps — unified into a single discoverable feed.
 *
 * @module @degenfeed/bluesky-sdk/atproto-firehose
 */

import type { CrossAppContent } from './atproto-directory';
import { APP_BADGE_COLORS } from './atproto-directory';
import { DEFAULT_USER_AGENT } from './index';

// ─── Types ─────────────────────────────────────────────────────────────

export interface FirehoseEvent {
  /** The DID of the repository that was updated */
  did: string;
  /** The AT Protocol collection/lexicon (e.g. app.bsky.feed.post) */
  collection: string;
  /** The record key */
  rkey: string;
  /** The operation: 'create' | 'update' | 'delete' */
  action: 'create' | 'update' | 'delete';
  /** The record value (for create/update) */
  record?: Record<string, unknown>;
  /** When the event happened (ISO 8601) */
  time: string;
  /** The commit CID */
  cid: string;
  /** The commit revision */
  rev: string;
}

export interface FirehoseSubscribeOpts {
  /** Relay URL to subscribe to (default: wss://bsky.network) */
  relayUrl?: string;
  /** Collections to filter (empty = all) */
  collections?: string[];
  /** Handle received events */
  onEvent: (event: FirehoseEvent) => void;
  /** Handle connection errors */
  onError?: (error: Error) => void;
  /** Handle connection state changes */
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
  /** Abort signal for stopping the subscription */
  signal?: AbortSignal;
}

export interface DiscoverOpts {
  /** Maximum number of items to return */
  limit?: number;
  /** Source apps to filter by (empty = all) */
  sourceApps?: string[];
  /** Content types to filter by (empty = all) */
  types?: CrossAppContent['type'][];
  /** Cursor for pagination */
  cursor?: string;
  /** Whether to include only trending content */
  trending?: boolean;
  /** PDS URL for fetching content */
  pdsUrl?: string;
}

export interface DiscoverResponse {
  items: CrossAppContent[];
  cursor?: string;
  hasMore: boolean;
  total: number;
  meta: {
    sourceApps: string[];
    filterApplied: boolean;
    fetchedAt: string;
  };
}

// ─── Collection/App Mappings ──────────────────────────────────────────

/**
 * Map AT Protocol collection/lexicon to source app key.
 */
const COLLECTION_TO_APP: Record<string, { app: string; type: CrossAppContent['type'] }> = {
  'app.bsky.feed.post': { app: 'bluesky', type: 'post' },
  'com.whtwnd.blog.entry': { app: 'whitewind', type: 'article' },
  'fyi.frontpage.post': { app: 'frontpage', type: 'link' },
  'events.smokesignal.event': { app: 'smokesignal', type: 'event' },
  'social.skylight.video': { app: 'skylight', type: 'video' },
  'app.bsky.graph.list': { app: 'bluesky', type: 'post' },
  'app.bsky.feed.like': { app: 'bluesky', type: 'post' },
  'app.bsky.feed.repost': { app: 'bluesky', type: 'post' },
  'app.bsky.feed.generator': { app: 'bluesky', type: 'post' },
  'com.skyfleet.group': { app: 'skyfleet', type: 'post' },
  'app.clocktower.track': { app: 'clocktower', type: 'post' },
};

const APP_TO_DISPLAY_NAME: Record<string, string> = {
  bluesky: 'Bluesky',
  whitewind: 'WhiteWind',
  frontpage: 'Frontpage',
  smokesignal: 'Smoke Signal',
  skylight: 'Skylight',
  deckblue: 'DeckBlue',
  graze: 'Graze',
  skyfleet: 'SkyFleet',
  clocktower: 'Clocktower',
};

// ─── App Names for Collections (reverse lookup) ────────────────────────

const COLLECTION_APP_NAMES: Record<
  string,
  { appKey: string; appName: string; type: CrossAppContent['type'] }
> = {};

// Build from COLLECTION_TO_APP
for (const [collection, mapping] of Object.entries(COLLECTION_TO_APP)) {
  COLLECTION_APP_NAMES[collection] = {
    appKey: mapping.app,
    appName: APP_TO_DISPLAY_NAME[mapping.app] || mapping.app,
    type: mapping.type,
  };
}

// ─── Content Discovery ────────────────────────────────────────────────

/**
 * Map an AT Protocol collection to CrossAppContent metadata.
 */
export function mapCollectionToApp(collection: string): {
  appKey: string;
  appName: string;
  type: CrossAppContent['type'];
} | null {
  return COLLECTION_APP_NAMES[collection] || null;
}

/**
 * Build a badge color from the source app.
 */
export function badgeColorForApp(appKey: string): string {
  return APP_BADGE_COLORS[appKey] || '#6B7280';
}

/**
 * Fetch recent content from the AT Protocol relay/subscription endpoint.
 * This pulls content from across all AT Protocol apps via the firehose.
 *
 * In production, this would connect to:
 *   - wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos
 *   - Or fetch from a relay cache
 *
 * For REST-based discovery, we query the PDS directly for recent records
 * across known collections.
 */
export async function discoverCrossAppContent(opts: DiscoverOpts = {}): Promise<DiscoverResponse> {
  const limit = Math.min(opts.limit || 50, 100);
  const pdsUrl = opts.pdsUrl || 'https://pds.degenfeed.xyz';
  const items: CrossAppContent[] = [];

  // Collections to query (all AT Protocol app collections)
  const collections = Object.keys(COLLECTION_TO_APP);

  // Filter by source apps if specified
  let targetCollections = collections;
  if (opts.sourceApps && opts.sourceApps.length > 0) {
    targetCollections = collections.filter((c) => {
      const mapping = COLLECTION_TO_APP[c];
      return mapping && opts.sourceApps!.includes(mapping.app);
    });
  }

  // Query each collection for recent records
  const collectionPromises = targetCollections.slice(0, 10).map(async (collection) => {
    const mapping = COLLECTION_TO_APP[collection];
    if (!mapping) return [];

    // Filter by content type if specified
    if (opts.types && opts.types.length > 0 && !opts.types.includes(mapping.type)) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        collection,
        limit: String(Math.ceil(limit / targetCollections.length) + 5),
      });

      const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`, {
        headers: {
          accept: 'application/json',
          'user-agent': DEFAULT_USER_AGENT,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return [];

      const data = (await res.json()) as {
        records: Array<{
          uri: string;
          cid: string;
          value: Record<string, unknown>;
        }>;
      };

      if (!data.records) return [];

      return data.records
        .map((record): CrossAppContent | null => {
          try {
            const value = record.value;
            const uriParts = record.uri.split('/');
            const rkey = uriParts[uriParts.length - 1] || '';
            const authorDid = uriParts[2] || '';

            // Extract text/description based on collection type
            let text = '';
            let title: string | undefined;

            if (collection === 'app.bsky.feed.post') {
              text = (value.text as string) || '';
            } else if (collection === 'com.whtwnd.blog.entry') {
              text = (value.content as string) || (value.text as string) || '';
              title = (value.title as string) || 'Untitled Article';
            } else if (collection === 'fyi.frontpage.post') {
              text = (value.text as string) || '';
              title = (value.title as string) || (value.url as string) || '';
            } else if (collection === 'events.smokesignal.event') {
              text = (value.description as string) || '';
              title = (value.name as string) || 'Untitled Event';
            } else {
              text = JSON.stringify(value).slice(0, 300);
            }

            // Skip empty content
            if (!text && !title) return null;

            // Extract author info
            const author = {
              did: authorDid || (value.author?.did as string) || '',
              handle: (value.author?.handle as string) || authorDid?.slice(0, 12) || 'unknown',
              displayName: (value.author?.displayName as string) || undefined,
              avatar: (value.author?.avatar as string) || undefined,
            };

            // Build URL based on content type
            let url: string | undefined;
            if (collection === 'app.bsky.feed.post') {
              url = `https://bsky.app/profile/${authorDid}/post/${rkey}`;
            } else if (collection === 'com.whtwnd.blog.entry') {
              url = `https://whtwnd.com/${authorDid}/${rkey}`;
            } else if (collection === 'fyi.frontpage.post') {
              url = `https://frontpage.fyi/post/${rkey}`;
            } else if (collection === 'events.smokesignal.event') {
              url = `https://smokesignal.events/e/${rkey}`;
            }

            return {
              id: record.cid,
              uri: record.uri,
              sourceApp: mapping.app,
              sourceAppName: APP_TO_DISPLAY_NAME[mapping.app] || mapping.app,
              type: mapping.type,
              author,
              title,
              text: text.slice(0, 500),
              url,
              publishedAt: (value.createdAt as string) || new Date().toISOString(),
              metrics: {
                likes: (value.likeCount as number) ?? (value.likes as number),
                reposts: (value.repostCount as number) ?? (value.reposts as number),
                replies: (value.replyCount as number) ?? (value.replies as number),
              },
              badgeColor: badgeColorForApp(mapping.app),
            };
          } catch {
            return null;
          }
        })
        .filter((item): item is CrossAppContent => item !== null);
    } catch {
      return [];
    }
  });

  // Execute all collection queries in parallel
  const results = await Promise.allSettled(collectionPromises);
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    }
  }

  // Sort by publishedAt descending
  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Apply limit
  const sliced = items.slice(0, limit);

  // Collect source apps present in results
  const sourceApps = [...new Set(sliced.map((i) => i.sourceApp))];

  return {
    items: sliced,
    hasMore: items.length > limit,
    total: items.length,
    meta: {
      sourceApps,
      filterApplied: !!(opts.sourceApps?.length || opts.types?.length),
      fetchedAt: new Date().toISOString(),
    },
  };
}

/**
 * Fetch content for a specific AT Protocol app by its collection.
 */
export async function discoverAppContent(
  appKey: string,
  limit = 25,
  pdsUrl = 'https://pds.degenfeed.xyz',
): Promise<CrossAppContent[]> {
  // Find the collection for this app
  const entry = Object.entries(COLLECTION_TO_APP).find(([, v]) => v.app === appKey);
  if (!entry) return [];

  const [collection] = entry;

  try {
    const params = new URLSearchParams({
      collection,
      limit: String(limit),
    });

    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`, {
      headers: {
        accept: 'application/json',
        'user-agent': DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];
    const data = (await res.json()) as {
      records: Array<{ uri: string; cid: string; value: Record<string, unknown> }>;
    };
    if (!data.records) return [];

    const mapping = COLLECTION_TO_APP[collection];

    return data.records
      .map((record): CrossAppContent | null => {
        try {
          const value = record.value;
          const uriParts = record.uri.split('/');
          const rkey = uriParts[uriParts.length - 1] || '';
          const authorDid = uriParts[2] || '';

          return {
            id: record.cid,
            uri: record.uri,
            sourceApp: appKey,
            sourceAppName: APP_TO_DISPLAY_NAME[appKey] || appKey,
            type: mapping.type,
            author: {
              did: authorDid,
              handle: (value.author?.handle as string) || authorDid.slice(0, 12),
            },
            title: (value.title as string) || undefined,
            text: (value.text as string) || (value.content as string) || '',
            url: `https://bsky.app/profile/${authorDid}/post/${rkey}`,
            publishedAt: (value.createdAt as string) || new Date().toISOString(),
            badgeColor: badgeColorForApp(appKey),
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is CrossAppContent => item !== null);
  } catch {
    return [];
  }
}
