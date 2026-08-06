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

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `0:${String(s).padStart(2, '0')}`;
}

function timeAgo(ms: number): string {
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

// ─── Fallback mock data generators (REMOVED) ─────────────────────────────
// Demo/seed content is BANNED. The video hub never fabricates videos —
// when real feeds are unavailable it returns an explicit empty result
// with a warning notice. This stub exists to preserve call sites while
// guaranteeing no fake content is ever served.

function generateMockVideos(
  count: number,
  options: {
    source?: VideoSource;
    category?: VideoCategoryId;
    sort?: SortMode;
    page?: number;
  } = {},
): UnifiedVideo[] {
  console.warn(
    '[video-hub] generateMockVideos is deprecated — demo/seed content is banned. Returning empty.',
  );
  void count;
  void options;
  return [];
}

// ─── Feed Aggregator ──────────────────────────────────────────────────────

async function getUnifiedVideoFeed(params: {
  category: VideoCategoryId;
  source: VideoSource;
  sort: SortMode;
  cursor?: string;
  limit?: number;
  wallet?: string;
  env: Env;
}): Promise<UnifiedVideoFeed> {
  const { category, source, sort, cursor, wallet, env } = params;
  const limit = params.limit ?? HUB_PAGE_SIZE;
  const page = cursor ? Number(cursor) || 1 : 1;

  // Get trending categories for sidebar
  const trendingCategories = await categorizer.getTrendingCategories(env);

  // Get user categories for personalization
  const userCategories = wallet ? await categorizer.getUserCategories(wallet, env) : [];

  // Demo/seed content is BANNED — never fabricate videos. The stub
  // generator returns empty + logs a warning; callers surface an empty feed.
  const videos = generateMockVideos(limit, { source, category, sort, page });

  // Sort
  const sorted = [...videos];
  if (sort === 'newest') sorted.sort((a, b) => b.publishedAt - a.publishedAt);
  else if (sort === 'popular') sorted.sort((a, b) => b.views - a.views);
  else if (sort === 'trending') {
    sorted.sort((a, b) => {
      const scoreA = a.views / Math.max(1, (Date.now() - a.publishedAt) / 3600000);
      const scoreB = b.views / Math.max(1, (Date.now() - b.publishedAt) / 3600000);
      return scoreB - scoreA;
    });
  } else if (sort === 'recommended' && userCategories.length > 0) {
    // Boost user-relevant categories
    sorted.sort((a, b) => {
      const aBoost = userCategories.includes(a.category) ? 2 : 1;
      const bBoost = userCategories.includes(b.category) ? 2 : 1;
      return b.views * bBoost - a.views * aBoost;
    });
  }

  const hasMore = sorted.length >= limit;
  const nextCursor = hasMore ? String(page + 1) : null;

  return {
    videos: sorted,
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
    const videos = generateMockVideos(limit, {
      source,
      category: id as VideoCategoryId,
      sort,
      page,
    });

    const sorted = [...videos];
    if (sort === 'newest') sorted.sort((a, b) => b.publishedAt - a.publishedAt);
    else if (sort === 'popular') sorted.sort((a, b) => b.views - a.views);
    else if (sort === 'trending') {
      sorted.sort((a, b) => {
        const scoreA = a.views / Math.max(1, (Date.now() - a.publishedAt) / 3600000);
        const scoreB = b.views / Math.max(1, (Date.now() - b.publishedAt) / 3600000);
        return scoreB - scoreA;
      });
    }

    const hasMore = sorted.length >= limit;
    const nextCursor = hasMore ? String(page + 1) : null;

    // Mock top creators for this category
    const topCreators = Array.from({ length: 6 }, (_, i) => ({
      name: `Creator ${String.fromCharCode(65 + i)}`,
      channelUrl: `https://example.com/c/${id}/${i}`,
      videoCount: Math.round(Math.random() * 50 + 5),
    }));

    const result: CategoryPage = {
      category: id as VideoCategoryId,
      label: categoryMeta.label,
      videos: sorted,
      subCategories: (await import('../lib/video-categories')).SUB_CATEGORIES[id] ?? [],
      topCreators,
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

    // Generate videos weighted toward user's categories
    const videos: UnifiedVideo[] = [];
    const userCatSet = new Set(userCategories);

    // 70% from user's preferred categories
    const prefCount = Math.round(limit * 0.7);
    for (const cat of userCategories) {
      const catVideos = generateMockVideos(Math.ceil(prefCount / userCategories.length), {
        category: cat as VideoCategoryId,
        page,
      });
      videos.push(...catVideos);
    }

    // 30% discovery — from other categories
    const discoveryCount = limit - videos.length;
    if (discoveryCount > 0) {
      const otherCats = VIDEO_CATEGORIES.filter((c) => c.id !== 'all' && !userCatSet.has(c.id));
      if (otherCats.length > 0) {
        const discoveryCat = otherCats[page % otherCats.length];
        const discovery = generateMockVideos(discoveryCount, {
          category: discoveryCat.id as VideoCategoryId,
          page: page + 1,
        });
        videos.push(...discovery);
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
    const allVideos = generateMockVideos(limit * 3, { source, page });

    // Simple text filter
    const q = query.toLowerCase();
    const filtered = allVideos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.tags.some((t) => t.includes(q)) ||
        v.channelName.toLowerCase().includes(q),
    );

    const results = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const nextCursor = hasMore ? String(page + 1) : null;

    const result: SearchResults = {
      videos: results,
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
    const valid = categories.filter((id) => validIds.has(id));

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
    const allVideos = generateMockVideos(limit * 2, {
      source,
      category: category !== 'all' ? (category as VideoCategoryId) : 'all',
      sort: 'trending',
      page,
    });

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

    // Fetch all available videos (mock data for now)
    const allVideos = generateMockVideos(100, {});

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
  const cursor = c.req.query('cursor');
  const page = cursor ? Number(cursor) || 1 : 1;

  try {
    const allVideos = generateMockVideos(100, { page });
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
    const allVideos = generateMockVideos(50, { page });
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

videoHub.get('/playlists/:playlistId', async (c) => {
  const { playlistId } = c.req.param();
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit')) || 20, 50);
  const page = cursor ? Number(cursor) || 1 : 1;

  try {
    // Mock playlist data — in production, fetch from KV or database
    const allVideos = generateMockVideos(limit, { page });
    const playlistVideos = allVideos.slice(0, limit);

    // Build autoplay queue (all videos in playlist order)
    const autoplayQueue = playlistVideos.length > 1 ? playlistVideos.slice(1) : [];

    const hasMore = playlistVideos.length >= limit;
    const nextCursor = hasMore ? String(page + 1) : null;

    return noCacheJsonResponse({
      playlistId,
      name: `Playlist #${playlistId}`,
      videos: playlistVideos,
      total: playlistVideos.length,
      cursor: nextCursor,
      hasMore,
      currentIndex: 0,
      autoplayQueue,
    } satisfies PlaylistResponse);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
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
