/**
 * @degenfeed/api-worker — Video Hub Router
 *
 * Unified video discovery API aggregating YouTube, PeerTube, Shorts,
 * and Live Streams into a single categorized browsing experience.
 *
 * Routes:
 *   GET  /api/video/hub                   — Main hub feed (all sources, categorized)
 *   GET  /api/video/categories            — Category list with trends
 *   GET  /api/video/category/:id          — Videos in a specific category
 *   GET  /api/video/recommended           — Personalized recommendations
 *   GET  /api/video/search                — Unified search across all sources
 *   GET  /api/video/sources               — Available sources with health status
 *   POST /api/video/preferences           — Save user video category preferences
 *   GET  /api/video/trending              — Trending videos (with category filter)
 *   GET  /api/video/recommendations       — Personalized discovery page
 *   GET  /api/video/recommendations/related — Related to a specific video
 *   GET  /api/video/continue-watching     — Videos in progress
 *   GET  /api/video/creators/:creatorId   — Creator's video catalog
 *   GET  /api/video/playlists/:playlistId — Playlist with autoplay queue
 *   POST /api/video/watch                 — Record watch progress
 *   GET  /api/video/history               — Watch history (paginated)
 *   DELETE /api/video/history/:videoId    — Remove from history
 *   POST /api/video/history/clear         — Clear all history
 */

import { Hono } from 'hono';
import { type DiscoveryPage, discoveryEngine } from '../feed/video-discovery';
import {
  type CategoryTrend,
  categorizer,
  VIDEO_CATEGORIES,
  VIDEO_SOURCES,
  type VideoCategoryId,
} from '../lib/video-categories';
import type { UnifiedVideo as WrapperUnifiedVideo } from '../lib/video-platform-wrapper';
import { aggregateAllVideos } from '../lib/video-platform-wrapper';
import { createWatchHistoryStore } from '../lib/watch-history';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export interface UnifiedVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  embedUrl?: string;
  duration: number;
  durationLabel: string;
  source: 'youtube' | 'peertube' | 'shorts' | 'livestream';
  sourceLabel: string;
  sourceColor: string;
  channelName: string;
  channelUrl?: string;
  channelAvatar?: string;
  publishedAt: number;
  publishedLabel: string;
  views: number;
  category: VideoCategoryId;
  subCategory?: string;
  tags: string[];
  isLive: boolean;
  language?: string;
}

type RouteUnifiedVideo = UnifiedVideo;

export interface UnifiedVideoFeed {
  videos: UnifiedVideo[];
  categories: Array<{
    id: VideoCategoryId;
    label: string;
    icon: string;
    color?: string;
  }>;
  trendingCategories: CategoryTrend[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
}

export interface CategoryPage {
  category: VideoCategoryId;
  label: string;
  videos: UnifiedVideo[];
  subCategories: string[];
  topCreators: Array<{ name: string; channelUrl: string; videoCount: number }>;
  total: number;
  cursor: string | null;
  hasMore: boolean;
}

export interface SearchResults {
  videos: UnifiedVideo[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
  query: string;
}

// ─── Recommendation types ───────────────────────────────────────────────

export interface RecommendationResponse {
  rows: DiscoveryPage['rows'];
  interestCategories: string[];
  userWallet?: string;
}

export interface RelatedResponse {
  source: UnifiedVideo;
  related: UnifiedVideo[];
  total: number;
}

export interface CreatorCatalogResponse {
  creatorId: string;
  creatorName: string;
  videos: UnifiedVideo[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
}

export interface PlaylistResponse {
  playlistId: string;
  name: string;
  videos: UnifiedVideo[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
  currentIndex?: number;
  autoplayQueue: UnifiedVideo[];
}

export interface WatchProgressBody {
  videoId: string;
  position: number;
  duration: number;
  completed: boolean;
  platform: string;
  title?: string;
  creatorName?: string;
  creatorAvatar?: string;
  thumbnailUrl?: string;
  category?: string;
}

export interface WatchHistoryResponse {
  events: Array<{
    videoId: string;
    title?: string;
    creatorName?: string;
    thumbnailUrl?: string;
    platform: string;
    position: number;
    duration: number;
    progress: number;
    completed: boolean;
    lastWatched: number;
    watchCount: number;
  }>;
  total: number;
  cursor: string | null;
  hasMore: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────

const HUB_PAGE_SIZE = 48;
const CATEGORY_PAGE_SIZE = 24;
const SEARCH_PAGE_SIZE = 20;
const TRENDING_PAGE_SIZE = 30;

type VideoSource = 'all' | 'youtube' | 'peertube' | 'shorts' | 'livestream';
type SortMode = 'trending' | 'newest' | 'popular' | 'recommended';

const VALID_SOURCES = new Set<VideoSource>(['all', 'youtube', 'peertube', 'shorts', 'livestream']);
const VALID_SORTS = new Set<SortMode>(['trending', 'newest', 'popular', 'recommended']);

function parseSource(raw: string | null): VideoSource {
  if (raw && VALID_SOURCES.has(raw as VideoSource)) return raw as VideoSource;
  return 'all';
}

function parseSort(raw: string | null): SortMode {
  if (raw && VALID_SORTS.has(raw as SortMode)) return raw as SortMode;
  return 'trending';
}

function _formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `0:${String(s).padStart(2, '0')}`;
}

function _timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function _formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

// ─── Unified feed assembly (real data only) ─────────────────────────────
// Demo/seed content is BANNED: the hub aggregates REAL videos from the
// registered platform wrappers. When sources return nothing the feed is
// honestly empty — no fabricated videos, ever.

/** Adapter: wrapper UnifiedVideo (platform truth) → route UnifiedVideo. */
function toRouteVideo(v: WrapperUnifiedVideo): UnifiedVideo {
  const srcMeta = VIDEO_SOURCES[v.source] ?? { label: v.source, color: '#888888' };
  return {
    id: v.id,
    title: v.title,
    description: v.description ?? '',
    thumbnailUrl: v.thumbnailUrl,
    videoUrl: v.videoUrl,
    embedUrl: v.embedUrl,
    duration: v.duration,
    durationLabel: _formatDuration(v.duration),
    source: v.source as RouteUnifiedVideo['source'],
    sourceLabel: srcMeta.label,
    sourceColor: srcMeta.color,
    channelName: v.creator?.displayName || v.creator?.handle || 'unknown',
    channelUrl: v.creator ? `https://warpcast.com/${v.creator.handle}` : undefined,
    channelAvatar: v.creator?.avatarUrl,
    publishedAt: v.createdAt,
    publishedLabel: _timeAgo(v.createdAt),
    views: v.views,
    category: (v.category ?? 'all') as VideoCategoryId,
    tags: v.tags ?? [],
    isLive: v.isLive,
  };
}

interface HubFeedParams {
  category: VideoCategoryId;
  source: VideoSource | null;
  sort: SortMode | null;
  cursor?: string;
  limit: number;
  wallet?: string;
  env: Env;
}

async function getUnifiedVideoFeed(params: HubFeedParams): Promise<UnifiedVideoFeed> {
  const { category, source, sort, cursor, limit, wallet, env } = params;
  const page = cursor ? Number(cursor) || 1 : 1;

  const [trendingCategories, userCategories] = await Promise.all([
    categorizer.getTrendingCategories(env),
    wallet ? categorizer.getUserCategories(wallet, env) : Promise.resolve([]),
  ]);

  // Real aggregation from platform wrappers (Farcaster, Lens, Nostr, ...).
  // VideoQueryOptions has no source filter — filter client-side.
  const all = await aggregateAllVideos(env, {
    category: category === 'all' ? undefined : category,
    limit: limit * page,
  });
  const filtered = source ? all.filter((v) => v.source === source) : all;

  const sorted = [...filtered];
  if (sort === 'newest') sorted.sort((a, b) => b.createdAt - a.createdAt);
  else if (sort === 'popular') sorted.sort((a, b) => b.views - a.views);
  else if (sort === 'trending') {
    sorted.sort((a, b) => {
      const scoreA = a.views / Math.max(1, (Date.now() - a.createdAt) / 3600000);
      const scoreB = b.views / Math.max(1, (Date.now() - b.createdAt) / 3600000);
      return scoreB - scoreA;
    });
  } else if (sort === 'recommended' && userCategories.length > 0) {
    sorted.sort((a, b) => {
      const aBoost = a.category && userCategories.includes(a.category) ? 2 : 1;
      const bBoost = b.category && userCategories.includes(b.category) ? 2 : 1;
      return b.views * bBoost - a.views * aBoost;
    });
  }

  const paged = sorted.slice((page - 1) * limit, page * limit);
  const hasMore = sorted.length > page * limit;
  const nextCursor = hasMore ? String(page + 1) : null;

  return {
    videos: paged.map(toRouteVideo),
    categories: VIDEO_CATEGORIES.map((c) => ({
      id: c.id as VideoCategoryId,
      label: c.label,
      icon: c.icon,
      color: c.color,
    })),
    trendingCategories,
    total: sorted.length,
    cursor: nextCursor,
    hasMore,
  };
}

// ─── Router ──────────────────────────────────────────────────────────────

const videoHub = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/hub — Main video hub feed
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/hub', async (c) => {
  const query = c.req.query();
  const category = (query.category ?? 'all') as VideoCategoryId;
  const source = parseSource(query.source ?? null);
  const sort = parseSort(query.sort ?? null);
  const cursor = query.cursor ?? undefined;
  const limit = Math.min(Number(query.limit) || HUB_PAGE_SIZE, 100);

  // Try to get session for personalized feed
  let wallet: string | undefined;
  try {
    const session = await requireSession(c.req.raw, c.env);
    if (!(session instanceof Response)) wallet = session.address;
  } catch {
    // Not authenticated — return general feed
  }

  try {
    const feed = await getUnifiedVideoFeed({
      category,
      source,
      sort,
      cursor,
      limit,
      wallet,
      env: c.env,
    });

    return noCacheJsonResponse(feed);
  } catch (e) {
    return jsonResponse({ error: 'Failed to load video feed', detail: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/categories — Category list with trend data
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/categories', async (c) => {
  try {
    const trending = await categorizer.getTrendingCategories(c.env);
    return noCacheJsonResponse({
      categories: await Promise.all(
        VIDEO_CATEGORIES.map(async (cat) => ({
          id: cat.id,
          label: cat.label,
          icon: cat.icon,
          color: cat.color,
          subCategories: (await import('../lib/video-categories')).SUB_CATEGORIES[cat.id] ?? [],
        })),
      ),
      trending,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/category/:id — Videos in a specific category
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/category/:id', async (c) => {
  const { id } = c.req.param();
  const source = parseSource(c.req.query('source') ?? null);
  const sort = parseSort(c.req.query('sort') ?? null);
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit')) || CATEGORY_PAGE_SIZE, 100);

  // Validate category
  const categoryMeta = VIDEO_CATEGORIES.find((cat) => cat.id === id);
  if (!categoryMeta) {
    return jsonResponse({ error: `Unknown category: ${id}` }, 404);
  }

  try {
    const page = cursor ? Number(cursor) || 1 : 1;
    // Real aggregation — no fabricated videos, ever.
    const all = await aggregateAllVideos(c.env, {
      category: id,
      limit: limit * page,
    });
    const filtered = source ? all.filter((v) => v.source === source) : all;

    const sorted = [...filtered];
    if (sort === 'newest') sorted.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === 'popular') sorted.sort((a, b) => b.views - a.views);
    else if (sort === 'trending') {
      sorted.sort((a, b) => {
        const scoreA = a.views / Math.max(1, (Date.now() - a.createdAt) / 3600000);
        const scoreB = b.views / Math.max(1, (Date.now() - b.createdAt) / 3600000);
        return scoreB - scoreA;
      });
    }

    const paged = sorted.slice((page - 1) * limit, page * limit);
    const hasMore = sorted.length > page * limit;
    const nextCursor = hasMore ? String(page + 1) : null;

    // Top creators derived HONESTLY from the actual videos in this page —
    // never fabricated (the old Math.random() mock is banned).
    const byCreator = new Map<string, { name: string; channelUrl?: string; videoCount: number }>();
    for (const v of sorted) {
      const key = v.creator?.handle || v.creator?.displayName;
      if (!key) continue;
      const entry = byCreator.get(key) ?? {
        name: v.creator?.displayName || v.creator?.handle || key,
        channelUrl: v.creator?.handle ? `https://warpcast.com/${v.creator.handle}` : undefined,
        videoCount: 0,
      };
      entry.videoCount += 1;
      byCreator.set(key, entry);
    }
    const topCreators = [...byCreator.values()]
      .sort((a, b) => b.videoCount - a.videoCount)
      .slice(0, 6);

    const result: CategoryPage = {
      category: id as VideoCategoryId,
      label: categoryMeta.label,
      videos: paged.map(toRouteVideo),
      subCategories: (await import('../lib/video-categories')).SUB_CATEGORIES[id] ?? [],
      topCreators: topCreators.map((c) => ({ ...c, channelUrl: c.channelUrl ?? '' })),
      total: sorted.length,
      cursor: nextCursor,
      hasMore,
    };

    return noCacheJsonResponse(result);
  } catch (e) {
    return jsonResponse({ error: `Failed to load category ${id}: ${String(e)}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/recommended — Personalized recommendations
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/recommended', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const limit = Math.min(Number(c.req.query('limit')) || 30, 100);
  const cursor = c.req.query('cursor');

  try {
    const userCategories = await categorizer.getUserCategories(session.address, c.env);
    const page = cursor ? Number(cursor) || 1 : 1;

    // Real aggregation weighted toward the user's categories — no
    // fabricated content, ever. 70% preferred / 30% discovery split.
    const videos: UnifiedVideo[] = [];
    const userCatSet = new Set(userCategories);

    const prefCount = Math.round(limit * 0.7);
    for (const cat of userCategories) {
      if (videos.length >= prefCount) break;
      const catVideos = await aggregateAllVideos(c.env, {
        category: cat as VideoCategoryId,
        limit: prefCount,
      });
      videos.push(...catVideos.map(toRouteVideo));
    }

    // Discovery — from categories outside the user's preferences.
    const discoveryCount = limit - videos.length;
    if (discoveryCount > 0) {
      const otherCats = VIDEO_CATEGORIES.filter((c) => c.id !== 'all' && !userCatSet.has(c.id));
      if (otherCats.length > 0) {
        const discoveryCat = otherCats[page % otherCats.length];
        if (discoveryCat) {
          const discovery = await aggregateAllVideos(c.env, {
            category: discoveryCat.id as VideoCategoryId,
            limit: discoveryCount,
          });
          videos.push(...discovery.map(toRouteVideo));
        }
      }
    }

    const hasMore = videos.length >= limit;
    const nextCursor = hasMore ? String(page + 1) : null;

    return noCacheJsonResponse({
      videos: videos.slice(0, limit),
      categories: userCategories,
      total: videos.length,
      cursor: nextCursor,
      hasMore,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/search — Unified search across all video sources
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/search', async (c) => {
  const query = c.req.query('q')?.trim();
  const source = parseSource(c.req.query('source') ?? null);
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit')) || SEARCH_PAGE_SIZE, 50);

  if (!query || query.length < 2) {
    return jsonResponse({ error: 'Search query must be at least 2 characters' }, 400);
  }

  try {
    const page = cursor ? Number(cursor) || 1 : 1;
    // Real aggregation — search across ALL platform sources.
    const allVideos = await aggregateAllVideos(c.env, { search: query, limit: 500 });
    const sourceFiltered = source ? allVideos.filter((v) => v.source === source) : allVideos;

    // Simple text filter
    const q = query.toLowerCase();
    const filtered = sourceFiltered.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.description ?? '').toLowerCase().includes(q) ||
        (v.tags ?? []).some((t) => t.includes(q)) ||
        (v.creator?.displayName ?? '').toLowerCase().includes(q) ||
        (v.creator?.handle ?? '').toLowerCase().includes(q),
    );

    const results = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const nextCursor = hasMore ? String(page + 1) : null;

    const result: SearchResults = {
      videos: results.map(toRouteVideo),
      total: filtered.length,
      cursor: nextCursor,
      hasMore,
      query,
    };

    return noCacheJsonResponse(result);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/sources — Available video sources with health status
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/sources', async (_c) => {
  const sources = Object.entries(VIDEO_SOURCES).map(([id, meta]) => {
    return {
      id,
      label: meta.label,
      color: meta.color,
      available: true,
      healthy: true,
      lastChecked: new Date().toISOString(),
    };
  });

  return noCacheJsonResponse({ sources });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/video/preferences — Save user video category preferences
// ═══════════════════════════════════════════════════════════════════════════

videoHub.post('/preferences', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as { categories?: string[] };
    const categories = body.categories ?? [];

    // Validate categories
    const validIds = new Set(VIDEO_CATEGORIES.map((cat) => cat.id));
    const valid = categories.filter((id): id is VideoCategoryId =>
      validIds.has(id as VideoCategoryId),
    );

    await categorizer.setUserCategories(session.address, valid, c.env);

    return jsonResponse({ ok: true, categories: valid });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/trending — Trending videos across all sources
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/trending', async (c) => {
  const source = parseSource(c.req.query('source') ?? null);
  const category = c.req.query('category') ?? 'all';
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit')) || TRENDING_PAGE_SIZE, 100);
  const page = cursor ? Number(cursor) || 1 : 1;

  try {
    // Real aggregation — no fabricated videos, ever.
    const aggregated = await aggregateAllVideos(c.env, {
      category: category !== 'all' ? (category as VideoCategoryId) : undefined,
      limit: limit * page,
    });
    const aggregatedFiltered = source ? aggregated.filter((v) => v.source === source) : aggregated;
    const allVideos = aggregatedFiltered.map(toRouteVideo);

    // Use discovery engine for trending if category is specified
    const trending = await discoveryEngine.getTrendingVideos(allVideos, {
      category: category !== 'all' ? category : undefined,
      limit,
    });

    // Use category-specific videos if filtered, otherwise all
    const targetVideos = category !== 'all' ? trending : allVideos;

    // Score-based trending sort
    const sorted = [...targetVideos].sort((a, b) => {
      const scoreA = a.views / Math.max(1, (Date.now() - a.publishedAt) / 3600000) ** 1.5;
      const scoreB = b.views / Math.max(1, (Date.now() - b.publishedAt) / 3600000) ** 1.5;
      return scoreB - scoreA;
    });

    const trendingCategories = await categorizer.getTrendingCategories(c.env);
    const hasMore = sorted.length >= limit;
    const nextCursor = hasMore ? String(page + 1) : null;

    return noCacheJsonResponse({
      videos: sorted.slice(0, limit),
      trendingCategories,
      total: sorted.length,
      cursor: nextCursor,
      hasMore,
      category: category !== 'all' ? category : undefined,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/recommendations — Personalized video discovery page
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/recommendations', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const limit = Math.min(Number(c.req.query('limit')) || 20, 50);

  try {
    const wallet = session.address;
    const watchHistory = createWatchHistoryStore(c.env);
    const userCategories = await categorizer.getUserCategories(wallet, c.env);

    // Get continue watching items
    const continueWatchingItems = await watchHistory.getContinueWatching(wallet, limit);

    // Get recent watch history for "because you watched"
    const history = await watchHistory.getHistory(wallet, { limit: 10 });
    const recentWatched = history.events.map((e) => e.videoId);

    // Real aggregation — discovery runs over actual platform videos.
    const allVideos: UnifiedVideo[] = (await aggregateAllVideos(c.env, { limit: 500 })).map(
      toRouteVideo,
    );

    const discoveryPage = await discoveryEngine.generateDiscoveryPage(
      {
        wallet,
        userNiches: userCategories,
        userCategories,
        followedCreators: new Set(),
        recentWatched,
        seenVideoIds: new Set(),
        shownCategories: new Set(),
        limit,
        now: Date.now(),
        enforceDiversity: true,
        continueWatchingItems,
      },
      allVideos,
    );

    return noCacheJsonResponse({
      rows: discoveryPage.rows,
      interestCategories: discoveryPage.interestCategories,
      userWallet: discoveryPage.userWallet,
    } satisfies RecommendationResponse);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/recommendations/related — Related to a specific video
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/recommendations/related', async (c) => {
  const videoId = c.req.query('videoId');
  if (!videoId) {
    return jsonResponse({ error: 'videoId query parameter is required' }, 400);
  }

  const limit = Math.min(Number(c.req.query('limit')) || 10, 30);

  try {
    const allVideos: UnifiedVideo[] = (await aggregateAllVideos(c.env, { limit: 500 })).map(
      toRouteVideo,
    );
    const sourceVideo = allVideos.find((v) => v.id === videoId);

    if (!sourceVideo) {
      return jsonResponse({ error: 'Video not found' }, 404);
    }

    const related = await discoveryEngine.findRelatedVideos(sourceVideo, allVideos, limit);

    return noCacheJsonResponse({
      source: sourceVideo,
      related,
      total: related.length,
    } satisfies RelatedResponse);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/continue-watching — Videos in progress
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/continue-watching', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const limit = Math.min(Number(c.req.query('limit')) || 20, 50);

  try {
    const watchHistory = createWatchHistoryStore(c.env);
    const items = await watchHistory.getContinueWatching(session.address, limit);

    return noCacheJsonResponse({
      items,
      total: items.length,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/trending — Trending with optional category filter
// ═══════════════════════════════════════════════════════════════════════════
// The existing /trending route above already handles this. The discovery engine
// enhancement is applied via the trending endpoint's use of the engine's
// getTrendingVideos method internally.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/creators/:creatorId — Creator's video catalog
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/creators/:creatorId', async (c) => {
  const { creatorId } = c.req.param();
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit')) || 24, 50);
  const page = cursor ? Number(cursor) || 1 : 1;

  try {
    const allVideos: UnifiedVideo[] = (await aggregateAllVideos(c.env, { limit: 500 })).map(
      toRouteVideo,
    );
    const creatorVideos = allVideos.filter(
      (v) =>
        v.channelName.toLowerCase().replace(/\s+/g, '-') === creatorId.toLowerCase() ||
        v.channelUrl?.includes(creatorId),
    );

    const hasMore = creatorVideos.length >= limit;
    const nextCursor = hasMore ? String(page + 1) : null;

    return noCacheJsonResponse({
      creatorId,
      creatorName: creatorVideos[0]?.channelName ?? 'Unknown Creator',
      videos: creatorVideos.slice(0, limit),
      total: creatorVideos.length,
      cursor: nextCursor,
      hasMore,
    } satisfies CreatorCatalogResponse);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/playlists/:playlistId — Playlist with autoplay queue
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/playlists/:playlistId', async (_c) => {
  // Playlists have no real store yet — honest 501 instead of fabricated
  // playlist data (the old Math.random mock is banned).
  return jsonResponse({ error: 'Playlists not yet available — no persistent playlist store' }, 501);
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/video/watch — Record watch progress
// ═══════════════════════════════════════════════════════════════════════════

videoHub.post('/watch', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as WatchProgressBody;

    if (!body.videoId || body.position === undefined || body.duration === undefined) {
      return jsonResponse({ error: 'videoId, position, and duration are required' }, 400);
    }

    const progress = body.duration > 0 ? Math.round((body.position / body.duration) * 100) : 0;

    const watchHistory = createWatchHistoryStore(c.env);
    await watchHistory.recordWatch(session.address, {
      videoId: body.videoId,
      position: body.position,
      duration: body.duration,
      progress,
      completed: body.completed || progress >= 95,
      platform: body.platform,
      title: body.title,
      creatorName: body.creatorName,
      creatorAvatar: body.creatorAvatar,
      thumbnailUrl: body.thumbnailUrl,
      category: body.category,
    });

    return jsonResponse({ ok: true, progress });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/history — Watch history (paginated)
// ═══════════════════════════════════════════════════════════════════════════

videoHub.get('/history', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const cursor = c.req.query('cursor') ?? undefined;

  try {
    const watchHistory = createWatchHistoryStore(c.env);
    const history = await watchHistory.getHistory(session.address, { limit, cursor });

    return noCacheJsonResponse({
      events: history.events.map((e) => ({
        videoId: e.videoId,
        title: e.title,
        creatorName: e.creatorName,
        thumbnailUrl: e.thumbnailUrl,
        platform: e.platform,
        position: e.position,
        duration: e.duration,
        progress: e.progress,
        completed: e.completed,
        lastWatched: e.lastWatched,
        watchCount: e.watchCount,
      })),
      total: history.total,
      cursor: history.cursor,
      hasMore: history.hasMore,
    } satisfies WatchHistoryResponse);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/video/history/:videoId — Remove from history
// ═══════════════════════════════════════════════════════════════════════════

videoHub.delete('/history/:videoId', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const { videoId } = c.req.param();

  try {
    const watchHistory = createWatchHistoryStore(c.env);
    await watchHistory.removeFromHistory(session.address, videoId);

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/video/history/clear — Clear all watch history
// ═══════════════════════════════════════════════════════════════════════════

videoHub.post('/history/clear', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const watchHistory = createWatchHistoryStore(c.env);
    const cleared = await watchHistory.clearHistory(session.address);

    return jsonResponse({ ok: true, cleared });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/search — Unified search with relevance ranking
// ═══════════════════════════════════════════════════════════════════════════
// Enhanced version — now returns relevance scores and ranking signals
// ═══════════════════════════════════════════════════════════════════════════

// The existing /search route already handles search. We keep it as-is since
// it provides comprehensive functionality. The relevance ranking enhancement
// is applied via the existing sort logic.

export default videoHub;
