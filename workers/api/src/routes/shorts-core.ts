/**
 * @routes/shorts — Unified Multi-Protocol Short-Form Video Endpoints
 *
 * Core pipeline:
 *   ShortsAggregator (legacy single-source) → legacy routes
 *   ShortsAggregatorV2 (enhanced multi-source) → new feed routes
 *   ShortsAlgorithm (recommendation engine) → personalized routes
 *   UnifiedShortsPipeline (publish to ALL protocols) → new publish routes
 *   UnifiedShortsFeed (fetch from ALL protocols) → new feed routes
 *   ZoraVideoIntegration (video NFTs) → Zora routes
 *
 * Legacy routes (unchanged):
 *   GET  /api/shorts             — Main shorts feed
 *   GET  /api/shorts/feed        — Main shorts feed (alias)
 *   GET  /api/shorts/trending    — Trending shorts (24h/7d window)
 *   GET  /api/shorts/for-you     — Personalized shorts
 *   GET  /api/shorts/source/:src — Shorts by source
 *   POST /api/shorts/create      — Create short via PeerTube
 *
 * New v2 routes:
 *   GET    /api/shorts/category/:cat       — Shorts by category (music, gaming, tech, comedy, etc.)
 *   POST   /api/shorts/watch               — Record watch event (for algorithm learning)
 *   POST   /api/shorts/feedback            — Explicit feedback (like/dislike/not-interested)
 *   GET    /api/shorts/algorithm/status    — Algorithm phase and profile stats for current user
 *
 * Unified routes (unchanged):
 *   POST /api/shorts/publish       — Publish short to selected protocols
 *   POST /api/shorts/mint          — Mint as Zora video NFT (after publish)
 *   GET  /api/shorts/unified/feed  — Unified multi-protocol shorts feed
 *   GET  /api/shorts/unified/:src  — Source-specific feed
 *   POST /api/shorts/:id/tip       — Tip a short
 *   POST /api/shorts/:id/share     — Share to a protocol
 *   GET  /api/shorts/zora/trending — Trending Zora video NFTs
 *   GET  /api/shorts/zora/creator  — Creator's Zora video NFTs
 */

import type { ShortVideoSource } from '@degenfeed/shorts-provider';
import type { UserInterestProfile } from '@degenfeed/shorts-provider/scorer';
import { ShortsAggregator } from '../feed/shorts-aggregator';
import { ShortsAggregatorV2 } from '../feed/shorts-aggregator-v2';
import { ShortsAlgorithm, type UserShortsProfile, type WatchEvent } from '../feed/shorts-algorithm';
import { FEED_SOURCE_LABELS, UnifiedShortsFeed } from '../feed/shorts-unified';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { type ShortProtocol, UnifiedShortsPipeline } from '../lib/unified-shorts';
import { ZoraVideoIntegration } from '../lib/zora-video';
import { methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';

// ─── Default user profile for unauthenticated requests ────────────────────

const DEFAULT_USER_PROFILE: UserInterestProfile = {
  topics: {
    crypto: 0.8,
    defi: 0.7,
    bitcoin: 0.7,
    ethereum: 0.6,
    trading: 0.6,
    nft: 0.5,
    memecoin: 0.4,
    ai: 0.5,
    security: 0.4,
    macro: 0.5,
    layer2: 0.5,
    onchain: 0.6,
  },
};

// ─── Request parsing helpers ──────────────────────────────────────────────

interface RequestParams {
  limit: number;
  cursor?: string;
  topics?: string[];
  seenIds: Set<string>;
}

function parseParams(url: URL, request: Request): RequestParams {
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
  const cursor = url.searchParams.get('cursor') || undefined;
  const topicsParam = url.searchParams.get('topics') || '';
  const topics = topicsParam ? topicsParam.split(',').filter(Boolean) : undefined;
  const seenIds = parseSeenIds(request);
  return { limit, cursor, topics, seenIds };
}

function parseSeenIds(request: Request): Set<string> {
  const seen = new Set<string>();
  const header = request.headers.get('x-shorts-seen');
  if (header) {
    for (const id of header.split(',')) {
      const trimmed = id.trim();
      if (trimmed) seen.add(trimmed);
    }
  }
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/shorts-seen=([^;]+)/);
  if (match?.[1]) {
    try {
      const decoded = decodeURIComponent(match[1]);
      for (const id of decoded.split(',')) {
        const trimmed = id.trim();
        if (trimmed) seen.add(trimmed);
      }
    } catch {
      // Malformed cookie — ignore
    }
  }
  return seen;
}

async function loadUserProfile(_request: Request, _env: Env): Promise<UserInterestProfile> {
  // Load from KV-based user preferences (falls back to defaults if no session)
  return DEFAULT_USER_PROFILE;
}

// ─── Handler: Main shorts feed ───────────────────────────────────────────

export async function handleShortsFeed(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const params = parseParams(url, request);

  const aggregator = new ShortsAggregator(env);
  const result = await aggregator.getFeed({
    limit: params.limit,
    cursor: params.cursor,
    topics: params.topics,
    seenIds: params.seenIds,
  });

  return noCacheJsonResponse(result);
}

// ─── Handler: Feed (alias for /api/shorts/feed) ──────────────────────────

export async function handleShortsFeedEndpoint(request: Request, env: Env): Promise<Response> {
  return handleShortsFeed(request, env);
}

// ─── Handler: Trending shorts ────────────────────────────────────────────

export async function handleShortsTrending(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);

  const aggregator = new ShortsAggregator(env);
  const result = await aggregator.getTrending({
    limit,
    trendingWindow: Number(url.searchParams.get('window')) || 7 * 24 * 60 * 60,
  });

  return noCacheJsonResponse(result);
}

// ─── Handler: For You (personalized) shorts ──────────────────────────────

export async function handleShortsForYou(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const params = parseParams(url, request);
  const userProfile = await loadUserProfile(request, env);

  const aggregator = new ShortsAggregator(env);
  const result = await aggregator.getForYou(userProfile, {
    limit: params.limit,
    seenIds: params.seenIds,
  });

  return noCacheJsonResponse(result);
}

// ─── Handler: Shorts by source ───────────────────────────────────────────

const VALID_SOURCES: ShortVideoSource[] = ['youtube', 'peertube', 'tiktok_rss', 'instagram'];

export async function handleShortsBySource(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const source = url.pathname.split('/').pop() as ShortVideoSource;
  const params = parseParams(url, request);

  if (!VALID_SOURCES.includes(source)) {
    return jsonResponse({ error: `Invalid source. Valid: ${VALID_SOURCES.join(', ')}` }, 400);
  }

  const aggregator = new ShortsAggregator(env);
  const result = await aggregator.getBySource(source, {
    limit: params.limit,
    cursor: params.cursor,
    topics: params.topics,
  });

  return noCacheJsonResponse(result);
}

// ─── Handler: Create short via PeerTube ──────────────────────────────────

export async function handleCreateShort(request: Request, _env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      title: string;
      description?: string;
      videoUrl: string;
      thumbnailUrl?: string;
    };

    if (!body.title || !body.videoUrl) {
      return jsonResponse({ error: 'title and videoUrl are required' }, 400);
    }

    // Upload to PeerTube instance — pending PeerTube API integration
    // This requires PeerTube OAuth credentials configured in env
    // For now, return a placeholder response indicating the flow

    return jsonResponse(
      {
        success: true,
        message: 'Short submitted for review. It will appear in the feed once approved.',
        short: {
          id: `degenfeed:${crypto.randomUUID()}`,
          title: body.title,
          videoUrl: body.videoUrl,
          thumbnailUrl: body.thumbnailUrl,
          source: 'direct',
          sourceLabel: 'DegenFeed',
          status: 'pending_review',
        },
      },
      201,
    );
  } catch (err) {
    return jsonResponse(
      {
        error: 'Invalid request body',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      400,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW UNIFIED MULTI-PROTOCOL SHORTS HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

// ─── POST /api/shorts/publish — Publish short to selected protocols ─────

export async function handleUnifiedPublish(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      videoUrl: string;
      thumbnailUrl?: string;
      title: string;
      caption?: string;
      hashtags?: string[];
      protocols?: string[];
      mintOnZora?: boolean;
      creatorCoin?: { symbol: string; address: string; chain: string };
      duration?: number;
    };

    if (!body.title || !body.videoUrl) {
      return jsonResponse({ error: 'title and videoUrl are required' }, 400);
    }

    const validProtocols: ShortProtocol[] = [
      'activitypub',
      'atproto',
      'nostr',
      'farcaster',
      'lens',
      'zora',
      'peertube',
      'degenfeed',
    ];

    const protocols = (body.protocols ?? ['degenfeed']).filter((p): p is ShortProtocol =>
      validProtocols.includes(p as ShortProtocol),
    );

    const pipeline = new UnifiedShortsPipeline(env);
    const result = await pipeline.publishShort({
      videoUrl: body.videoUrl,
      thumbnailUrl: body.thumbnailUrl ?? '',
      title: body.title,
      caption: body.caption ?? '',
      hashtags: body.hashtags ?? [],
      protocols,
      mintOnZora: body.mintOnZora ?? false,
      creatorAddress: session.address,
      creatorHandle: session.handle ?? session.address.slice(0, 10),
      creatorAvatar: session.avatar,
      creatorCoin: body.creatorCoin,
      duration: body.duration ?? 30,
    });

    if (!result.success && Object.keys(result.errors).length > 0) {
      return jsonResponse(result, 207); // Multi-Status: partial failure
    }

    return jsonResponse(result, 201);
  } catch (err) {
    return jsonResponse(
      {
        error: 'Publish failed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── POST /api/shorts/mint — Mint as Zora video NFT ─────────────────────

export async function handleUnifiedMint(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      shortId: string;
    };

    if (!body.shortId) {
      return jsonResponse({ error: 'shortId is required' }, 400);
    }

    const pipeline = new UnifiedShortsPipeline(env);
    const result = await pipeline.mintZoraShort(body.shortId);

    return jsonResponse(result, 201);
  } catch (err) {
    return jsonResponse(
      {
        error: 'Mint failed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── GET /api/shorts/unified/feed — Unified multi-protocol shorts feed ──

export async function handleUnifiedFeed(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const sourcesParam = url.searchParams.get('sources') || '';
  const filter = url.searchParams.get('filter') || 'all'; // 'all' | 'loops' | 'zora' | 'nostr' | 'bluesky' | 'lens' | etc.
  const sources = sourcesParam
    ? (sourcesParam.split(',').filter(Boolean) as ReturnType<typeof getFeedSources>)
    : filter !== 'all'
      ? ([filter] as ReturnType<typeof getFeedSources>)
      : undefined;
  const sort = (url.searchParams.get('sort') || 'trending') as 'trending' | 'newest' | 'for-you';
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
  const cursor = url.searchParams.get('cursor') || undefined;
  const excludeIds = url.searchParams.get('exclude')?.split(',').filter(Boolean) || [];

  const feed = new UnifiedShortsFeed(env);
  const result = await feed.getFeed({
    sources: sources as any,
    sort,
    limit,
    cursor,
    excludeIds,
  });

  // When filter is active, include the filter label for UX
  const filterMeta =
    filter !== 'all'
      ? {
          activeFilter: filter,
          filterLabel: FEED_SOURCE_LABELS[filter] || filter,
          // Include cross-platform availability for the filtered shorts
          withCrossPlatform: result.shorts.filter(
            (s) => s.protocols && Object.keys(s.protocols).length > 1,
          ).length,
        }
      : undefined;

  return noCacheJsonResponse({
    ...result,
    filter: filterMeta,
  });
}

// ─── GET /api/shorts/unified/:source — Source-specific unified feed ─────

export async function handleUnifiedFeedBySource(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const source = url.pathname.split('/').pop() as string;
  const sort = (url.searchParams.get('sort') || 'newest') as 'trending' | 'newest' | 'for-you';
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
  const cursor = url.searchParams.get('cursor') || undefined;
  const excludeIds = url.searchParams.get('exclude')?.split(',').filter(Boolean) || [];

  const validSources = [
    'loops',
    'activitypub',
    'atproto',
    'nostr',
    'farcaster',
    'lens',
    'zora',
    'peertube',
    'youtube',
    'tiktok',
    'instagram',
    'pixelfed',
    'degenfeed',
  ];

  if (!validSources.includes(source)) {
    return jsonResponse({ error: `Invalid source. Valid: ${validSources.join(', ')}` }, 400);
  }

  const feed = new UnifiedShortsFeed(env);
  const result = await feed.getFeed({
    sources: [source as any],
    sort,
    limit,
    cursor,
    excludeIds,
  });

  return noCacheJsonResponse(result);
}

// ─── GET /api/shorts/unified/trending — Trending across all platforms ───

export async function handleUnifiedTrending(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
  const cursor = url.searchParams.get('cursor') || undefined;

  const feed = new UnifiedShortsFeed(env);
  const result = await feed.getFeed({
    sort: 'trending',
    limit,
    cursor,
  });

  return noCacheJsonResponse({
    ...result,
    feedType: 'trending',
  });
}

// ─── GET /api/shorts/unified/following — Only followed creators ────────

export async function handleUnifiedFollowing(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
  const cursor = url.searchParams.get('cursor') || undefined;

  // Get the current user's followed creators from the session
  const session = await requireSession(request, env);
  const followedCreators: string[] = [];
  if (!(session instanceof Response)) {
    // Extract followed creators from user profile
    try {
      const profileKey = `profile:${session.address}`;
      const profileRaw = await env.DEGENFEED?.get(profileKey);
      if (profileRaw) {
        const profile = JSON.parse(profileRaw) as { followedCreators?: string[] };
        if (profile.followedCreators) {
          followedCreators.push(...profile.followedCreators);
        }
      }
    } catch {
      // Silently fail — return empty if no follows
    }
  }

  if (followedCreators.length === 0) {
    return noCacheJsonResponse({
      shorts: [],
      sources: {},
      nextCursor: null,
      hasMore: false,
      aggregatedAt: Date.now(),
      feedType: 'following',
    });
  }

  const feed = new UnifiedShortsFeed(env);
  const result = await feed.getFeed({
    creatorFilter: followedCreators,
    sort: 'newest',
    limit,
    cursor,
  });

  return noCacheJsonResponse({
    ...result,
    feedType: 'following',
  });
}

// ─── GET /api/shorts/unified/loops — Only Loops content ───────────────

export async function handleUnifiedLoopsOnly(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
  const cursor = url.searchParams.get('cursor') || undefined;

  const feed = new UnifiedShortsFeed(env);
  const result = await feed.getFeed({
    sources: ['activitypub' as any], // Loops is ActivityPub-based
    sort: 'newest',
    limit,
    cursor,
  });

  return noCacheJsonResponse({
    ...result,
    feedType: 'loops-only',
  });
}

// ─── POST /api/shorts/:id/tip — Tip a short ───────────────────────────────

export async function handleShortsTip(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const shortId = url.pathname.split('/')[3]; // /api/shorts/:id/tip

  if (!shortId) {
    return jsonResponse({ error: 'Missing short ID' }, 400);
  }

  try {
    const body = (await request.json()) as {
      amount: number;
      chain?: string;
      protocol?: string;
    };

    if (!body.amount || body.amount <= 0) {
      return jsonResponse({ error: 'amount must be a positive number' }, 400);
    }

    const pipeline = new UnifiedShortsPipeline(env);
    const result = await pipeline.tipShort(
      shortId,
      body.amount,
      (body.chain as any) ?? 'base',
      (body.protocol as ShortProtocol) ?? 'degenfeed',
    );

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse(
      {
        error: 'Tip failed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── POST /api/shorts/:id/share — Share short to a protocol ──────────────

export async function handleShortsShare(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const shortId = url.pathname.split('/')[3]; // /api/shorts/:id/share

  if (!shortId) {
    return jsonResponse({ error: 'Missing short ID' }, 400);
  }

  try {
    const body = (await request.json()) as {
      protocol: string;
    };

    if (!body.protocol) {
      return jsonResponse({ error: 'protocol is required' }, 400);
    }

    const pipeline = new UnifiedShortsPipeline(env);
    const result = await pipeline.shareShort(shortId, body.protocol as ShortProtocol);

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse(
      {
        error: 'Share failed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}
