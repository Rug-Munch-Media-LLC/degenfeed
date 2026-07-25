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
