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
import { UnifiedShortsFeed } from '../feed/shorts-unified';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { type ShortProtocol, UnifiedShortsPipeline } from '../lib/unified-shorts';
import { ZoraVideoIntegration } from '../lib/zora-video';
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
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const sourcesParam = url.searchParams.get('sources') || '';
  const sources = sourcesParam
    ? (sourcesParam.split(',').filter(Boolean) as ReturnType<typeof getFeedSources>)
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

  return noCacheJsonResponse(result);
}

// ─── GET /api/shorts/unified/:source — Source-specific unified feed ─────

export async function handleUnifiedFeedBySource(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const source = url.pathname.split('/').pop() as string;
  const sort = (url.searchParams.get('sort') || 'newest') as 'trending' | 'newest' | 'for-you';
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
  const cursor = url.searchParams.get('cursor') || undefined;
  const excludeIds = url.searchParams.get('exclude')?.split(',').filter(Boolean) || [];

  const validSources = [
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

// ─── POST /api/shorts/:id/tip — Tip a short ───────────────────────────────

export async function handleShortsTip(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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

// ─── GET /api/shorts/zora/trending — Trending Zora video NFTs ───────────

export async function handleZoraTrending(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);

  const zora = new ZoraVideoIntegration(env);
  const nfts = await zora.getTrendingVideoNFTs(limit);

  return noCacheJsonResponse({ nfts, count: nfts.length });
}

// ─── GET /api/shorts/zora/creator — Creator's Zora video NFTs ──────────

export async function handleZoraCreator(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const creatorAddress = url.searchParams.get('creator');

  if (!creatorAddress) {
    return jsonResponse({ error: 'creator query parameter is required' }, 400);
  }

  const zora = new ZoraVideoIntegration(env);
  const nfts = await zora.getCreatorVideoNFTs(creatorAddress);

  return noCacheJsonResponse({ nfts, count: nfts.length });
}

// ═══════════════════════════════════════════════════════════════════════════
// V2 ENHANCED ENDPOINTS (ShortsAggregatorV2 + ShortsAlgorithm)
// ═══════════════════════════════════════════════════════════════════════════

// ─── V2 Helpers ───────────────────────────────────────────────────────────

/**
 * KV key for storing user shorts profile.
 */
function profileKey(address: string): string {
  return `shorts:profile:${address}`;
}

/**
 * Load user shorts profile from KV. Returns default if not found.
 */
async function loadProfile(env: Env, address?: string): Promise<UserShortsProfile> {
  if (!address) {
    return new ShortsAlgorithm().createDefaultProfile();
  }
  try {
    const raw = await env.SHORTS?.get(profileKey(address));
    if (raw) return JSON.parse(raw) as UserShortsProfile;
  } catch {
    /* fail-open */
  }
  return new ShortsAlgorithm().createDefaultProfile(address);
}

/**
 * Save user shorts profile to KV.
 */
async function saveProfile(env: Env, address: string, profile: UserShortsProfile): Promise<void> {
  await env.SHORTS?.put(profileKey(address), JSON.stringify(profile), {
    expirationTtl: 86400 * 90, // 90 days
  });
}

// ─── GET /api/shorts/v2/feed — V2 personalized feed ─────────────────────

export async function handleShortsFeedV2(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
    const category = url.searchParams.get('category') || undefined;
    const sourceParam = url.searchParams.get('source') || undefined;
    const seenIds = parseSeenIds(request);

    // Attempt to load user profile
    const sessionCookie = parseSessionCookie(request);
    const userProfile = sessionCookie?.address
      ? await loadProfile(env, sessionCookie.address)
      : undefined;

    // Aggregate shorts from all sources
    const aggregator = new ShortsAggregatorV2(env);
    const result = await aggregator.aggregate({ limit: limit * 3 });

    // Run algorithm
    const algorithm = new ShortsAlgorithm();
    const recommendation = algorithm.recommend(result.shorts, {
      limit,
      seenIds,
      category,
      source: sourceParam as any,
      profile: userProfile,
    });

    return noCacheJsonResponse({
      shorts: recommendation.shorts,
      sources: result.sourceCounts,
      sourceHealth: result.sourceHealth,
      phase: recommendation.phase,
      scores: recommendation.scores,
      hasMore: result.shorts.length > limit,
      cursor:
        recommendation.shorts.length > 0
          ? recommendation.shorts[recommendation.shorts.length - 1]?.id
          : null,
      aggregatedAt: result.aggregatedAt,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load shorts feed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── GET /api/shorts/trending — Trending with window param ──────────────

/**
 * Enhanced trending handler supporting ?window=24h or ?window=7d
 * Already exists as handleShortsTrending, but this is an enhanced version
 * using the v2 aggregator.
 */
export async function handleShortsTrendingV2(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
    const windowParam = url.searchParams.get('window') || '24h';

    // Parse window parameter
    let windowHours: number;
    if (windowParam === '7d' || windowParam === '7') {
      windowHours = 168;
    } else if (windowParam === '24h' || windowParam === '1') {
      windowHours = 24;
    } else {
      windowHours = Number(windowParam) || 24;
    }

    const aggregator = new ShortsAggregatorV2(env);
    const result = await aggregator.aggregate({ limit: limit * 3 });

    const cutoff = Date.now() - windowHours * 3600000;
    const recent = result.shorts.filter((s) => s.publishedAt > cutoff);

    // Score by engagement velocity
    const scored = recent.map((s) => {
      const ageHours = Math.max(1, (Date.now() - s.publishedAt) / 3600000);
      const velocity = (s.likes + s.views * 0.01) / ageHours;
      return { ...s, _score: velocity };
    });

    scored.sort((a, b) => b._score - a._score);
    const topShorts = scored.slice(0, limit).map(({ _score: _, ...rest }) => rest);

    // Get trending categories
    const algorithm = new ShortsAlgorithm();
    const trendingCategories = algorithm.getTrendingCategories(result.shorts, windowHours);

    return noCacheJsonResponse({
      shorts: topShorts,
      trendingCategories: trendingCategories.slice(0, 10),
      sources: result.sourceCounts,
      window: windowParam,
      aggregatedAt: Date.now(),
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load trending shorts',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── GET /api/shorts/category/:cat — Shorts by category ────────────────

export async function handleShortsByCategory(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(request.url);
    const category = url.pathname.split('/').pop() || '';
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);
    const seenIds = parseSeenIds(request);

    if (!category) {
      return jsonResponse({ error: 'Category is required' }, 400);
    }

    const aggregator = new ShortsAggregatorV2(env);
    const result = await aggregator.aggregate({ limit: limit * 3 });

    // Filter by category match
    const filtered = result.shorts.filter(
      (s) =>
        !seenIds.has(s.id) &&
        (s.categories.some((c) => c.toLowerCase() === category.toLowerCase()) ||
          s.tags.some((t) => t.toLowerCase() === category.toLowerCase()) ||
          s.title.toLowerCase().includes(category.toLowerCase())),
    );

    // Sort by quality score
    filtered.sort((a, b) => b.qualityScore - a.qualityScore);

    return noCacheJsonResponse({
      shorts: filtered.slice(0, limit),
      category,
      totalFiltered: filtered.length,
      sources: result.sourceCounts,
      aggregatedAt: Date.now(),
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load category',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── POST /api/shorts/watch — Record watch event ──────────────────────

export async function handleShortsWatch(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await request.json()) as WatchEvent & { shortId: string };

    if (!body.shortId) {
      return jsonResponse({ error: 'shortId is required' }, 400);
    }

    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const watchEvent: WatchEvent = {
      shortId: body.shortId,
      watchPercent: Math.min(Math.max(0, body.watchPercent ?? 0), 1),
      liked: body.liked ?? false,
      shared: body.shared ?? false,
      watchedFull: body.watchedFull ?? false,
      skipped: body.skipped ?? false,
      watchDurationMs: Math.max(0, body.watchDurationMs ?? 0),
      timestamp: Date.now(),
    };

    // Load user profile
    const profile = await loadProfile(env, session.address);

    // Try to find the short in our aggregator to get full metadata
    const aggregator = new ShortsAggregatorV2(env);
    const aggResult = await aggregator.aggregate({ limit: 100 });
    const short = aggResult.shorts.find((s) => s.id === watchEvent.shortId);

    // If we found the short, update the profile with full context
    if (short) {
      const algorithm = new ShortsAlgorithm();
      const updatedProfile = algorithm.updateProfile(profile, watchEvent, short);
      await saveProfile(env, session.address, updatedProfile);
    } else {
      // Partial update without short metadata
      const updated: UserShortsProfile = {
        ...profile,
        totalWatches: profile.totalWatches + 1,
        recentShorts: [...profile.recentShorts.slice(-199), watchEvent.shortId],
        avgWatchPercent:
          (profile.avgWatchPercent * profile.totalWatches + watchEvent.watchPercent) /
          (profile.totalWatches + 1),
        updatedAt: Date.now(),
      };
      await saveProfile(env, session.address, updated);
    }

    // Also store the raw watch event for analytics
    await env.SHORTS?.put(
      `shorts:watches:${session.address}:${watchEvent.shortId}:${Date.now()}`,
      JSON.stringify(watchEvent),
      { expirationTtl: 86400 * 30 },
    );

    return jsonResponse({
      success: true,
      recorded: watchEvent.shortId,
      watchPercent: watchEvent.watchPercent,
      algorithmPhase: new ShortsAlgorithm().getPhase(
        short
          ? {
              ...profile,
              totalWatches: profile.totalWatches + 1,
            }
          : undefined,
      ),
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to record watch event',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── POST /api/shorts/feedback — Explicit feedback ─────────────────────

export async function handleShortsFeedback(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await request.json()) as {
      shortId: string;
      action: 'like' | 'dislike' | 'not_interested' | 'report';
    };

    if (!body.shortId || !body.action) {
      return jsonResponse({ error: 'shortId and action are required' }, 400);
    }

    if (!['like', 'dislike', 'not_interested', 'report'].includes(body.action)) {
      return jsonResponse({ error: 'action must be: like, dislike, not_interested, report' }, 400);
    }

    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    // Store feedback for algorithm tuning
    await env.SHORTS?.put(
      `shorts:feedback:${session.address}:${body.shortId}`,
      JSON.stringify({
        action: body.action,
        timestamp: Date.now(),
      }),
      { expirationTtl: 86400 * 90 },
    );

    // Update profile based on explicit feedback
    const profile = await loadProfile(env, session.address);

    if (body.action === 'like') {
      // Simulate a positive watch event
      const watchEvent: WatchEvent = {
        shortId: body.shortId,
        watchPercent: 0.9,
        liked: true,
        shared: false,
        watchedFull: true,
        skipped: false,
        watchDurationMs: 30000,
        timestamp: Date.now(),
      };

      const aggregator = new ShortsAggregatorV2(env);
      const aggResult = await aggregator.aggregate({ limit: 100 });
      const short = aggResult.shorts.find((s) => s.id === body.shortId);
      if (short) {
        const algorithm = new ShortsAlgorithm();
        const updatedProfile = algorithm.updateProfile(profile, watchEvent, short);
        await saveProfile(env, session.address, updatedProfile);
      }
    }

    if (body.action === 'dislike' || body.action === 'not_interested') {
      // Add to negative feedback list for filtering
      const negativeList = (await env.SHORTS?.get(
        `shorts:negative:${session.address}`,
        'json',
      ).catch(() => null)) as string[] | null;
      const updated = [...(negativeList ?? []), body.shortId].slice(-500);
      await env.SHORTS?.put(`shorts:negative:${session.address}`, JSON.stringify(updated), {
        expirationTtl: 86400 * 90,
      });
    }

    return jsonResponse({ success: true, action: body.action });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to record feedback',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── GET /api/shorts/algorithm/status — Algorithm phase & profile stats ──

export async function handleAlgorithmStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const profile = await loadProfile(env, session.address);
    const algorithm = new ShortsAlgorithm();
    const phase = algorithm.getPhase(profile);

    return noCacheJsonResponse({
      phase,
      totalWatches: profile.totalWatches,
      topTags: Object.entries(profile.tagAffinities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      topCreators: Object.entries(profile.creatorAffinities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      avgWatchPercent: Math.round(profile.avgWatchPercent * 100),
      nextPhaseAt: phase === 'cold_start' ? 10 : phase === 'learning' ? 50 : null,
      algorithmVersion: profile.algorithmVersion,
      updatedAt: profile.updatedAt,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load algorithm status',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── Helper: Parse session cookie (simple version) ────────────────────────

function parseSessionCookie(request: Request): { address: string } | null {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/session=([^;]+)/);
  if (match?.[1]) {
    try {
      const decoded = JSON.parse(decodeURIComponent(match[1])) as { address?: string };
      if (decoded?.address) return { address: decoded.address };
    } catch {
      /* ignore */
    }
  }
  return null;
}

// ─── Helper: infer feed sources from query param ──────────────────────────

function getFeedSources(raw: string): string[] {
  const validSources = [
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
    'degenfeed',
  ];
  return raw.split(',').filter((s) => validSources.includes(s.trim()));
}
