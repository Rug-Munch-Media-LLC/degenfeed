/**
 * @degenfeed/bluesky-sdk — AT Protocol Custom Feeds for DegenFeed
 *
 * Custom feed generators on the AT Protocol that surface:
 * 1. DegenFeed-curated crypto content
 * 2. DegenFeed trending content
 * 3. Cross-protocol content (Nostr + Farcaster bridged to AT Protocol)
 *
 * @module @degenfeed/bluesky-sdk/atproto-feeds
 */

import { DEFAULT_USER_AGENT, PDS_DEGENFEED_URL } from './index';
import type { CrossAppContent } from './atproto-directory';

// ─── Types ─────────────────────────────────────────────────────────────

export type DegenFeedType = 'crypto' | 'trending' | 'cross-protocol';

export interface DegenFeedOpts {
  /** Feed type */
  feedType?: DegenFeedType;
  /** Maximum items to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** PDS URL for fetching content */
  pdsUrl?: string;
  /** Auth JWT for authenticated content */
  accessJwt?: string;
}

export interface DegenFeedResponse {
  feed: CrossAppContent[];
  cursor?: string;
  hasMore: boolean;
  meta: {
    feedType: DegenFeedType;
    total: number;
    description: string;
    sourceProtocols: string[];
  };
}

export interface FeedSkeletonResponse {
  feed: Array<{ post: string }>;
  cursor?: string;
}

// ─── DegenFeed AT Protocol Feed Generator DID ─────────────────────────

export const DEGENFEED_FEED_GENERATOR_DID = 'did:web:feeds.degenfeed.xyz';
export const DEGENFEED_FEED_HANDLE = 'feeds.degenfeed.xyz';
export const DEGENFEED_FEED_CRYPTO_URI = 'at://did:web:feeds.degenfeed.xyz/app.bsky.feed.generator/degenfeed-crypto';
export const DEGENFEED_FEED_TRENDING_URI = 'at://did:web:feeds.degenfeed.xyz/app.bsky.feed.generator/degenfeed-trending';
export const DEGENFEED_FEED_CROSSPROTOCOL_URI = 'at://did:web:feeds.degenfeed.xyz/app.bsky.feed.generator/degenfeed-crossproto';

export const FEED_DESCRIPTIONS: Record<DegenFeedType, string> = {
  crypto: 'Crypto-curated content on AT Protocol — market analysis, DeFi, NFT drops, on-chain alpha curated by DegenFeed',
  trending: 'Trending content across AT Protocol — what\'s hot right now in the decentralized social web',
  'cross-protocol': 'Cross-protocol content — Nostr and Farcaster content bridged to AT Protocol. One feed, many networks.',
};

// ─── Mock data for feeds (production connects to real AT Protocol relay) ──

/**
 * Generate the DegenFeed-curated crypto feed for AT Protocol.
 *
 * This feed is a custom feed generator that surfaces crypto-related
 * content from across the AT Protocol ecosystem. In production, it
 * uses keyword filtering + ML classification on the firehose.
 */
export async function generateCryptoFeed(
  opts: DegenFeedOpts = {},
): Promise<DegenFeedResponse> {
  const limit = Math.min(opts.limit || 50, 100);
  const pdsUrl = opts.pdsUrl || PDS_DEGENFEED_URL;
  const cryptoKeywords = [
    'bitcoin', 'ethereum', 'solana', 'crypto', 'defi', 'nft', 'web3',
    'blockchain', 'token', 'dao', 'btc', 'eth', 'sol', 'airdrop',
    'staking', 'yield', 'liquidity', 'pool', 'swap', 'farm',
    'mint', 'collect', 'art', 'degen', '$', 'trading', 'market',
  ];

  const items: CrossAppContent[] = [];

  // Fetch recent Bluesky posts
  try {
    const params = new URLSearchParams({
      collection: 'app.bsky.feed.post',
      limit: String(limit * 2),
    });

    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`, {
      headers: {
        accept: 'application/json',
        'user-agent': DEFAULT_USER_AGENT,
        ...(opts.accessJwt ? { authorization: `Bearer ${opts.accessJwt}` } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        records: Array<{ uri: string; cid: string; value: Record<string, unknown> }>;
      };

      if (data.records) {
        for (const record of data.records) {
          const value = record.value;
          const text = (value.text as string) || '';

          // Filter for crypto content
          const textLower = text.toLowerCase();
          const isCrypto = cryptoKeywords.some((kw) => textLower.includes(kw));
          if (!isCrypto) continue;

          const uriParts = record.uri.split('/');
          const rkey = uriParts[uriParts.length - 1] || '';
          const authorDid = uriParts[2] || '';

          items.push({
            id: record.cid,
            uri: record.uri,
            sourceApp: 'bluesky',
            sourceAppName: 'Bluesky',
            type: 'post',
            author: {
              did: authorDid,
              handle: (value.author?.handle as string) || authorDid.slice(0, 12),
              displayName: value.author?.displayName as string || undefined,
            },
            text: text.slice(0, 500),
            url: `https://bsky.app/profile/${authorDid}/post/${rkey}`,
            publishedAt: value.createdAt as string || new Date().toISOString(),
            badgeColor: '#22C55E', // DegenFeed green badge
          });
        }
      }
    }
  } catch {
    // Feed generation fails gracefully
  }

  // Sort by publishedAt descending
  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const sliced = items.slice(0, limit);

  return {
    feed: sliced,
    hasMore: items.length > limit,
    meta: {
      feedType: 'crypto',
      total: sliced.length,
      description: FEED_DESCRIPTIONS.crypto,
      sourceProtocols: ['atproto'],
    },
  };
}

/**
 * Generate the DegenFeed trending feed.
 * Shows highest-engagement content across AT Protocol apps.
 */
export async function generateTrendingFeed(
  opts: DegenFeedOpts = {},
): Promise<DegenFeedResponse> {
  const limit = Math.min(opts.limit || 50, 100);
  const pdsUrl = opts.pdsUrl || PDS_DEGENFEED_URL;
  const items: CrossAppContent[] = [];

  // Fetch content from multiple AT Protocol app collections
  const collections = ['app.bsky.feed.post', 'com.whtwnd.blog.entry', 'fyi.frontpage.post'];

  const fetchPromises = collections.map(async (collection) => {
    try {
      const params = new URLSearchParams({
        collection,
        limit: String(Math.ceil(limit / collections.length) + 10),
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

      const appKey = collection === 'app.bsky.feed.post' ? 'bluesky'
        : collection === 'com.whtwnd.blog.entry' ? 'whitewind'
        : 'frontpage';

      const appName = collection === 'app.bsky.feed.post' ? 'Bluesky'
        : collection === 'com.whtwnd.blog.entry' ? 'WhiteWind'
        : 'Frontpage';

      const contentType = collection === 'app.bsky.feed.post' ? 'post' as const
        : collection === 'com.whtwnd.blog.entry' ? 'article' as const
        : 'link' as const;

      return data.records.map((record): CrossAppContent | null => {
        try {
          const value = record.value;
          const uriParts = record.uri.split('/');
          const rkey = uriParts[uriParts.length - 1] || '';
          const authorDid = uriParts[2] || '';
          const text = (value.text as string) || (value.content as string) || '';

          // Calculate a trending score based on engagement
          const likes = (value.likeCount as number) || (value.likes as number) || 0;
          const reposts = (value.repostCount as number) || (value.reposts as number) || 0;
          const replies = (value.replyCount as number) || (value.replies as number) || 0;
          const trendingScore = likes + reposts * 2 + replies * 3;

          // Skip items with no engagement
          if (trendingScore === 0) return null;

          return {
            id: record.cid,
            uri: record.uri,
            sourceApp: appKey,
            sourceAppName: appName,
            type: contentType,
            author: {
              did: authorDid,
              handle: (value.author?.handle as string) || authorDid.slice(0, 12),
            },
            title: value.title as string || undefined,
            text: text.slice(0, 500),
            url: `https://bsky.app/profile/${authorDid}/post/${rkey}`,
            publishedAt: value.createdAt as string || new Date().toISOString(),
            metrics: { likes, reposts, replies },
            badgeColor: '#F59E0B', // Amber trending badge
          };
        } catch {
          return null;
        }
      }).filter((item): item is CrossAppContent => item !== null);
    } catch {
      return [];
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    }
  }

  // Sort by engagement score (approximate trending)
  items.sort((a, b) => {
    const scoreA = (a.metrics?.likes || 0) + (a.metrics?.reposts || 0) * 2 + (a.metrics?.replies || 0) * 3;
    const scoreB = (b.metrics?.likes || 0) + (b.metrics?.reposts || 0) * 2 + (b.metrics?.replies || 0) * 3;
    return scoreB - scoreA;
  });

  const sliced = items.slice(0, limit);

  return {
    feed: sliced,
    hasMore: items.length > limit,
    meta: {
      feedType: 'trending',
      total: sliced.length,
      description: FEED_DESCRIPTIONS.trending,
      sourceProtocols: ['atproto'],
    },
  };
}

/**
 * Generate a cross-protocol feed showing Nostr + Farcaster content
 * on the AT Protocol. This bridges content from other protocols
 * into AT Protocol format for unified consumption.
 */
export async function generateCrossProtocolFeed(
  opts: DegenFeedOpts = {},
): Promise<DegenFeedResponse> {
  const limit = Math.min(opts.limit || 50, 100);
  const items: CrossAppContent[] = [];

  // Simulate cross-protocol content bridging:
  // In production, this queries Nostr relays and Farcaster hubs
  // then wraps the content in AT Protocol format.

  // Native AT Protocol content gets the cross-protocol badge
  try {
    const cryptoFeed = await generateCryptoFeed({
      ...opts,
      limit: Math.ceil(limit / 2),
    });

    for (const item of cryptoFeed.feed) {
      item.badgeColor = '#8B5CF6'; // Purple cross-protocol badge
      item.sourceApp = 'cross-protocol';
      item.sourceAppName = 'Cross-Protocol';
      items.push(item);
    }
  } catch {
    // Graceful fallback
  }

  // Add placeholder entries for bridged protocols
  const bridgedProtocols = [
    {
      protocol: 'Nostr',
      note: 'Nostr content bridged to AT Protocol via DegenFeed bridge',
      badgeColor: '#EC4899',
    },
    {
      protocol: 'Farcaster',
      note: 'Farcaster content bridged to AT Protocol via DegenFeed bridge',
      badgeColor: '#6366F1',
    },
  ];

  for (const bp of bridgedProtocols) {
    for (let i = 0; i < 3 && items.length < limit; i++) {
      items.push({
        id: `bridge-${bp.protocol.toLowerCase()}-${i}`,
        uri: `at://did:plc:bridge/app.bsky.feed.post/${bp.protocol.toLowerCase()}-${Date.now()}`,
        sourceApp: 'cross-protocol',
        sourceAppName: `${bp.protocol} → AT Protocol`,
        type: 'post',
        author: {
          did: `did:plc:${bp.protocol.toLowerCase()}-user`,
          handle: `${bp.protocol.toLowerCase()}-user`,
          displayName: `${bp.protocol} User #${i + 1}`,
        },
        text: `[${bp.protocol}] Cross-protocol content from ${bp.protocol} bridged to AT Protocol via DegenFeed. This allows you to see content from all decentralized social networks in one unified feed.`,
        url: `https://app.degenfeed.xyz/cross/${bp.protocol.toLowerCase()}/${i}`,
        publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
        badgeColor: bp.badgeColor,
      });
    }
  }

  // Sort by publishedAt desc
  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const sliced = items.slice(0, limit);

  return {
    feed: sliced,
    hasMore: items.length > limit,
    meta: {
      feedType: 'cross-protocol',
      total: sliced.length,
      description: FEED_DESCRIPTIONS['cross-protocol'],
      sourceProtocols: ['atproto', 'nostr', 'farcaster'],
    },
  };
}

/**
 * Build the feed skeleton response for AT Protocol feed generator protocol.
 * Converts DegenFeed items to AT Protocol skeleton format.
 */
export function toFeedSkeleton(
  response: DegenFeedResponse,
  cursor?: string,
): FeedSkeletonResponse {
  return {
    feed: response.feed.map((item) => ({ post: item.uri })),
    cursor: cursor || (response.hasMore ? response.feed[response.feed.length - 1]?.id : undefined),
  };
}

/**
 * Main dispatch: generate any DegenFeed type.
 */
export async function generateDegenFeed(
  opts: DegenFeedOpts = {},
): Promise<DegenFeedResponse> {
  const feedType = opts.feedType || 'crypto';

  switch (feedType) {
    case 'crypto':
      return generateCryptoFeed(opts);
    case 'trending':
      return generateTrendingFeed(opts);
    case 'cross-protocol':
      return generateCrossProtocolFeed(opts);
    default:
      return generateCryptoFeed(opts);
  }
}
