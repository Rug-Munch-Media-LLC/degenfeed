/**
 * Feed unified routes — /api/feed/unified/*
 *
 * Universal content pipeline API that fills DegenFeed timelines with
 * quality content from EVERY connected network.
 *
 * Endpoints:
 *   GET  /api/feed/unified              — Unified feed with all sources
 *   GET  /api/feed/unified/trending      — Trending across all networks
 *   GET  /api/feed/unified/for-you       — Personalized feed
 *   GET  /api/feed/unified/category/:id  — Category-specific feed
 *   GET  /api/feed/unified/search        — Search across all networks
 *   GET  /api/feed/unified/sources       — Available feed sources with health
 *   POST /api/feed/unified/default       — Build default feed (new users)
 *
 * Query params (most endpoints):
 *   wallet     — User's wallet address (for personalization)
 *   sort       — trending | newest | curated | for-you
 *   limit      — Max posts (default 50, max 200)
 *   cursor     — Pagination cursor
 *   sources    — Comma-separated source keys (activitypub,nostr,farcaster,...)
 *   protocols  — Comma-separated protocol names
 *   q          — Search query (search endpoint only)
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import {
  type BuildFeedOptions,
  buildDefaultFeed,
  ContentPipeline,
  DEFAULT_FEED_CATEGORIES,
  FEED_SOURCES,
  type FeedSourceKey,
  type NetworkCategory,
} from '../feed/content-pipeline';
import { checkProvidersHealth } from '../feed/feed-fetcher';
import { getSeedContent } from '../feed/seed-content';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Helper to enrich posts with badges + seed fallback ─────────────────

function enrichWithBadges(posts: UnifiedPost[]): Array<UnifiedPost & Record<string, unknown>> {
  return posts.map((p) => {
    const badge = badgeForProtocol(p.protocol);
    return { ...p, sourceBadge: badge.emoji, sourceColor: badge.color, sourceLabel: badge.label };
  });
}

function seedFallback(
  limit: number,
  protocol?: string,
): Array<UnifiedPost & Record<string, unknown>> {
  const seed = getSeedContent(limit, protocol);
  return seed.map((p) => ({
    ...p,
    sourceBadge: '●',
    sourceColor: '#666',
    sourceLabel: 'Demo',
    _demo: true,
  }));
}

function parseSources(raw: string | null): FeedSourceKey[] | undefined {
  if (!raw || raw === 'all') return undefined;
  return raw.split(',').map((s) => s.trim().toLowerCase()) as FeedSourceKey[];
}

function parseProtocols(raw: string | null): Protocol[] | undefined {
  if (!raw) return undefined;
  return raw.split(',').map((s) => s.trim().toLowerCase()) as Protocol[];
}

function parseSort(raw: string | null): BuildFeedOptions['sort'] {
  switch (raw) {
    case 'trending':
    case 'curated':
    case 'for-you':
      return raw;
    case 'newest':
    case 'latest': // Frontend default sort — newest first
      return 'newest';
    default:
      return 'trending';
  }
}

/**
 * Parse a time-range filter into hours. Accepts the frontend's `time`
 * param values (1h, 24h, 7d, all) as well as the API's `timeRange`.
 */
function parseTimeRangeHours(raw: string | null): number | undefined {
  if (!raw) return undefined;
  switch (raw.trim()) {
    case '1h':
    case '1':
      return 1;
    case '24h':
    case '24':
      return 24;
    case '7d':
    case '168':
      return 168;
    case 'all':
    case '0':
      return undefined;
    default: {
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    }
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/feed/unified
 * Main unified feed — blends content from all requested sources.
 */
export async function handleUnifiedFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const wallet = params.get('wallet') ?? undefined;
  const sort = parseSort(params.get('sort'));
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const cursor = params.get('cursor') ?? undefined;
  const sources = parseSources(params.get('sources'));
  const protocols = parseProtocols(params.get('protocols'));
  const categoriesRaw = params.get('categories');
  const categories = categoriesRaw ? categoriesRaw.split(',').filter(Boolean) : undefined;

  // ── Quality/diversity params (forwarded by the frontend) ──────
  const niches = params
    .get('niches')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const contentTypes = params
    .get('contentType')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const timeRangeHours = parseTimeRangeHours(params.get('time') ?? params.get('timeRange'));
  const minEngagement = Number(params.get('minEngagement')) || 0;
  const excludeProtocols = parseProtocols(params.get('excludeProtocols'));
  const excludeWords = params
    .get('excludeWords')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const pipeline = new ContentPipeline(env);
  const feed = await pipeline.buildFeed({
    wallet,
    protocols,
    categories,
    sources,
    sort,
    limit,
    cursor,
    niches,
    contentTypes,
    timeRangeHours,
    minEngagement,
    excludeProtocols,
    excludeWords,
  });

  // Real aggregated posts when any provider returned content. Seed/demo
  // content is only served when EVERY real source failed.
  const posts = feed.posts.length > 0 ? feed.posts : seedFallback(limit);

  return jsonResponse({
    data: enrichWithBadges(posts as UnifiedPost[]),
    meta: {
      total: posts.length,
      sourceBreakdown: feed.sourceBreakdown,
      nextCursor: feed.nextCursor,
      generatedAt: feed.generatedAt,
      isDemo: feed.posts.length === 0,
      sort,
      quality: {
        applied: true,
        scorer: 'unified-v3',
        fields: [
          'engagement',
          'freshness',
          'content-length',
          'media',
          'verified-author',
          'niche-relevance',
        ],
        diversity: { interleaveProtocols: true, maxPostsPerAuthor: 2, mixCategories: true },
      },
    },
  });
}

/**
 * GET /api/feed/unified/trending
 * Trending content across all networks — ranked by engagement velocity.
 */
export async function handleTrendingContent(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const windowHours = Number(params.get('window')) || 24;
  const minEngagement = Number(params.get('minEngagement')) || 1;
  const protocols = parseProtocols(params.get('protocols'));

  const pipeline = new ContentPipeline(env);
  const posts = await pipeline.getTrendingContent({
    windowHours,
    minEngagement,
    limit,
    protocols,
  });

  // Never return empty — use seed content fallback
  const finalPosts = posts.length > 0 ? posts : seedFallback(limit);
  const enriched = enrichWithBadges(finalPosts as UnifiedPost[]);

  return jsonResponse({
    data: enriched,
    meta: {
      total: enriched.length,
      windowHours,
      minEngagement,
      isDemo: posts.length === 0,
    },
  });
}

/**
 * GET /api/feed/unified/for-you
 * Personalized feed based on wallet's behavior profile.
 */
export async function handleForYouFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const wallet = params.get('wallet') ?? undefined;
  const limit = Math.min(Number(params.get('limit')) || 50, 200);

  const pipeline = new ContentPipeline(env);

  if (!wallet) {
    // No wallet = anonymous user. Return trending as "for-you" default.
    const posts = await pipeline.getTrendingContent({ limit });
    const finalPosts = posts.length > 0 ? posts : seedFallback(limit);
    const enriched = enrichWithBadges(finalPosts as UnifiedPost[]);
    return jsonResponse({
      data: enriched,
      meta: {
        total: enriched.length,
        note:
          posts.length === 0
            ? 'demo-content-no-account'
            : 'anonymous-user-falling-back-to-trending',
        isDemo: posts.length === 0,
      },
    });
  }

  const curated = await pipeline.getCuratedContent({ wallet, limit });
  const finalPosts = curated.length > 0 ? curated : seedFallback(limit);
  const enriched = enrichWithBadges(finalPosts as UnifiedPost[]);

  return jsonResponse({
    data: enriched,
    meta: { total: enriched.length, wallet, isDemo: curated.length === 0 },
  });
}

/**
 * GET /api/feed/unified/category/:id
 * Category-specific feed — filters content to a specific category.
 * Falls back to related categories if primary is thin.
 */
export async function handleCategoryFeed(
  request: Request,
  env: Env,
  categoryId: string,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const wallet = params.get('wallet') ?? undefined;

  // Check if this is one of our default categories
  const defaultCat = DEFAULT_FEED_CATEGORIES.find((c) => c.id === categoryId);
  if (defaultCat?.tags) {
    // Search by tags — fetch all and filter
    const pipeline = new ContentPipeline(env);
    const posts = await pipeline.getTrendingContent({ limit: limit * 2 });
    const tags = defaultCat.tags.map((t) => t.toLowerCase());

    const filtered = posts.filter((p) => {
      const text = `${p.text} ${p.niches.join(' ')}`.toLowerCase();
      return tags.some((tag) => text.includes(tag));
    });

    // Never return empty
    const finalPosts =
      filtered.length > 0 ? filtered.slice(0, limit) : seedFallback(limit, categoryId);
    const enriched = enrichWithBadges(finalPosts as UnifiedPost[]);

    return jsonResponse({
      data: enriched,
      meta: {
        total: enriched.length,
        category: categoryId,
        label: defaultCat.label,
        isDemo: filtered.length === 0,
      },
    });
  }

  // If not a text-tag category, treat as a feed category slug
  const pipeline = new ContentPipeline(env);
  const feed = await pipeline.buildFeed({
    wallet,
    categories: [categoryId],
    sort: 'trending',
    limit,
  });

  const finalPosts = feed.posts.length > 0 ? feed.posts : seedFallback(limit, categoryId);

  return jsonResponse({
    data: enrichWithBadges(finalPosts as UnifiedPost[]),
    meta: {
      total: finalPosts.length,
      category: categoryId,
      sourceBreakdown: feed.sourceBreakdown,
      nextCursor: feed.nextCursor,
      isDemo: feed.posts.length === 0,
    },
  });
}

/**
 * GET /api/feed/unified/search
 * Search across all connected networks by keyword.
 */
export async function handleUnifiedSearch(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query = params.get('q');
  const limit = Math.min(Number(params.get('limit')) || 50, 200);

  if (!query || query.trim().length === 0) {
    return jsonResponse({ data: [], meta: { total: 0, query: '' } });
  }

  const pipeline = new ContentPipeline(env);
  const posts = await pipeline.fetchAllAvailable(undefined, limit * 2);

  const q = query.toLowerCase();
  const matched = posts.filter((p) => {
    const searchText = [
      p.text,
      p.author.displayName,
      p.author.bio,
      ...p.niches,
      p.community?.title,
      p.community?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchText.includes(q);
  });

  // If no search results, show seed content with search notice
  const finalPosts = matched.length > 0 ? matched.slice(0, limit) : seedFallback(limit);
  const enriched = enrichWithBadges(finalPosts as UnifiedPost[]);

  return jsonResponse({
    data: enriched,
    meta: {
      total: enriched.length,
      query,
      matchedTotal: matched.length,
      isDemo: matched.length === 0,
      notice: matched.length === 0 ? `No results for "${query}" — showing demo content` : undefined,
    },
  });
}

/**
 * GET /api/feed/unified/sources
 * List all available feed sources with their health status and weight.
 */
export async function handleSourceDiscovery(_request: Request, env: Env): Promise<Response> {
  const healthMap = await checkProvidersHealth(env);

  const sources = Object.values(FEED_SOURCES).map((def) => {
    const providerHealth = def.protocol ? healthMap[def.protocol] : undefined;

    return {
      id: def.id,
      label: def.label,
      emoji: def.emoji,
      color: def.color,
      weight: def.weight,
      network: def.network,
      protocol: def.protocol ?? null,
      healthy: providerHealth?.healthy ?? null,
      latencyMs: providerHealth?.latencyMs ?? null,
      error: providerHealth?.error ?? null,
    };
  });

  // Group by network category
  const byNetwork: Record<string, typeof sources> = {};
  for (const source of sources) {
    const network = source.network || 'other';
    if (!byNetwork[network]) byNetwork[network] = [];
    byNetwork[network].push(source);
  }

  return jsonResponse({
    data: sources,
    meta: {
      total: sources.length,
      byNetwork,
      categories: DEFAULT_FEED_CATEGORIES,
    },
  });
}

/**
 * POST /api/feed/unified/default
 * Build a default feed for brand new users (no connections needed).
 * Always returns a rich, diverse feed from all networks.
 */
export async function handleDefaultFeed(_request: Request, env: Env): Promise<Response> {
  const feed = await buildDefaultFeed(env);
  const limit = Math.min(Number(new URL(_request.url).searchParams.get('limit')) || 50, 200);

  // Never return empty for new user default feed
  const posts = feed.posts.length > 0 ? feed.posts : seedFallback(limit);
  const enriched = enrichWithBadges(posts as UnifiedPost[]);

  return jsonResponse({
    data: enriched,
    meta: {
      total: enriched.length,
      sourceBreakdown: feed.sourceBreakdown,
      generatedAt: feed.generatedAt,
      note: feed.posts.length === 0 ? 'default-feed-with-demo' : 'default-feed-for-new-users',
      isDemo: feed.posts.length === 0,
    },
  });
}

/**
 * GET /api/feed/unified/network/:network
 * Get content from a specific network category (video, social, publishing, etc.)
 */
export async function handleNetworkFeed(
  request: Request,
  env: Env,
  network: string,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 50, 200);

  const validNetworks: NetworkCategory[] = [
    'decentralized-social',
    'discussion',
    'publishing',
    'video',
    'music-audio',
    'events',
    'native',
    'creator-coins',
  ];

  if (!validNetworks.includes(network as NetworkCategory)) {
    return jsonResponse({ error: `Unknown network category: ${network}`, validNetworks }, 400);
  }

  const pipeline = new ContentPipeline(env);
  const posts = await pipeline.getNetworkContent(network as NetworkCategory);

  // Never return empty — seed fallback
  const finalPosts = posts.length > 0 ? posts.slice(0, limit) : seedFallback(limit, network);
  const enriched = enrichWithBadges(finalPosts as UnifiedPost[]);

  return jsonResponse({
    data: enriched,
    meta: { total: enriched.length, network, isDemo: posts.length === 0 },
  });
}

// ─── Internal helper (shared) ───────────────────────────────────────────

function badgeForProtocol(protocol: string): { emoji: string; color: string; label: string } {
  const sourceDef = Object.values(FEED_SOURCES).find(
    (s) => s.protocol === protocol || s.id === protocol,
  );
  if (sourceDef) {
    return { emoji: sourceDef.emoji, color: sourceDef.color, label: sourceDef.label };
  }
  return { emoji: '●', color: '#666', label: protocol };
}
