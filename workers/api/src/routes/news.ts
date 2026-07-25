/**
 * /api/news — Intelligent news endpoints.
 *
 * Endpoints:
 *   GET  /api/news/feed                   → Personalized news feed
 *   GET  /api/news/trending               → Trending stories (by velocity)
 *   GET  /api/news/category/:category     → News by category
 *   GET  /api/news/story/:storyId         → Story detail with related stories
 *   GET  /api/news/search                 → Search news archives
 *   GET  /api/news/sources                → All news sources with credibility ratings
 *   POST /api/news/preferences            → Update news preferences
 *   GET  /api/news/digest/preview         → Preview today's digest
 *   POST /api/news/digest/subscribe       → Subscribe to digest emails
 */

import type { UnifiedPost } from '@degenfeed/types';
import { sanitizePosts } from '../feed/feed-enricher';
import {
  type AggregatedStory,
  type AggregationOptions,
  type AggregationResult,
  aggregateNews,
  NEWS_SOURCES,
} from '../feed/news-aggregator';
import {
  DEFAULT_PREFERENCES,
  inferUserProfile,
  type NewsPreferences,
  type PersonalizedStory,
  personalizeNewsFeed,
  type ReadHistoryEntry,
  type UserProfile,
} from '../feed/personalized-news';
import { classifyStories, classifyStory, getTopCategories } from '../feed/topic-modeler';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';

// ─── Constants ───────────────────────────────────────────────────────────

const NEWS_FEED_CACHE_PREFIX = 'news:feed:v1:';
const NEWS_FEED_CACHE_TTL = 300; // 5 min
const NEWS_SOURCES_CACHE_KEY = 'news:sources:v1';
const NEWS_SOURCES_CACHE_TTL = 3600; // 1 hour

const ALLOWED_NICHES = new Set([
  'bitcoin',
  'ethereum',
  'solana',
  'defi',
  'nft',
  'ai',
  'regulation',
  'security',
  'macro',
  'memecoin',
  'layer2',
  'stablecoin',
  'etf',
  'onchain',
  'crypto',
  'tech',
  'finance',
  'culture',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────

function isValidEmail(s: string): boolean {
  if (typeof s !== 'string') return false;
  if (s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function safeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── GET /api/news/feed — Personalized News Feed ────────────────────────

export async function handleNewsFeed(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const category = url.searchParams.get('category') || '';
  const query = url.searchParams.get('q') || '';
  const sort = (url.searchParams.get('sort') || 'score') as 'score' | 'newest' | 'trending';
  const minTier = Number(url.searchParams.get('minTier')) || 0;
  const wallet = url.searchParams.get('wallet') || '';
  const sourceIds = url.searchParams.get('sources')?.split(',').filter(Boolean);

  // Build cache key from params
  const cacheKey = `${NEWS_FEED_CACHE_PREFIX}${category || 'all'}:${query || 'none'}:${sort}:${limit}:${sourceIds?.join(',') || 'all'}`;

  // Check cache
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return noCacheJsonResponse(parsed);
    }
  } catch {
    /* cache miss */
  }

  // Fetch user preferences if wallet provided
  let prefs: NewsPreferences = { ...DEFAULT_PREFERENCES };
  let profile: UserProfile | null = null;
  if (wallet && env.CACHE) {
    try {
      const prefsRaw = await env.CACHE.get(`user:news_prefs:${wallet.toLowerCase()}`);
      if (prefsRaw) {
        const stored = JSON.parse(prefsRaw) as Partial<NewsPreferences>;
        prefs = { ...prefs, ...stored };
      }
      const historyRaw = await env.CACHE.get(`user:news_history:${wallet.toLowerCase()}`);
      if (historyRaw) {
        const history = JSON.parse(historyRaw) as ReadHistoryEntry[];
        profile = inferUserProfile(history);
      }
    } catch {
      /* non-critical */
    }
  }

  // Aggregate news
  const opts: AggregationOptions = {
    limit: limit * 2, // fetch extra for personalization filtering
    category,
    query,
    minTier,
    sourceIds,
    sort,
  };

  const result = await aggregateNews(env, opts);

  // Personalize if user has preferences
  const personalized =
    wallet || Object.keys(prefs.topicWeights).length > 0
      ? personalizeNewsFeed(result.stories, prefs, profile)
      : result.stories.map(
          (s) =>
            ({
              ...s,
              scoreComponents: {
                topicalRelevance: 0.5,
                sourceCredibility: s.credibility,
                freshness: Math.max(0, 1 - (Date.now() - s.publishedAt) / 259200000),
                engagementVelocity: Math.min(1, s.velocity / 10),
                depthMatch: 0.5,
                sentimentBias:
                  s.sentiment.label === 'bullish'
                    ? 1.1
                    : s.sentiment.label === 'bearish'
                      ? 0.9
                      : 1.0,
                storyImportance:
                  1 + (s.alsoCoveredBy.length > 3 ? 0.3 : 0) + (s.isBreaking ? 0.5 : 0),
                total: s.score,
              },
              isDiscovery: false,
              classification: classifyStory(s),
            }) as PersonalizedStory,
        );

  // Classify for breadcrumbs
  const classifications = classifyStories(result.stories);

  // Build response
  const response = {
    data: personalized.slice(0, limit).map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary,
      url: s.url,
      source: s.source,
      sourceMeta: {
        id: s.sourceMeta.id,
        name: s.sourceMeta.name,
        tier: s.sourceMeta.tier,
        credibility: s.sourceMeta.credibility,
      },
      author: s.author,
      publishedAt: s.publishedAt,
      imageUrl: s.imageUrl,
      categories: s.categories,
      niches: s.niches,
      sentiment: s.sentiment,
      entities: s.entities,
      alsoCoveredBy: s.alsoCoveredBy,
      isBreaking: s.isBreaking,
      velocity: s.velocity,
      score: s.scoreComponents?.total ?? s.score,
      scoreComponents: s.scoreComponents,
      isDiscovery: s.isDiscovery,
      classification: s.classification,
    })),
    clusters: result.clusters.slice(0, 10).map((c) => ({
      id: c.id,
      title: c.title,
      storyCount: c.totalCoverage,
      topCategories: c.topCategories,
      topEntities: c.topEntities,
      aggregateSentiment: c.aggregateSentiment,
    })),
    meta: {
      ...result.meta,
      limit,
      category: category || 'all',
      query: query || undefined,
      personalized: !!wallet || Object.keys(prefs.topicWeights).length > 0,
      topCategories: getTopCategories(classifications, 10),
    },
  };

  // Cache
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), {
      expirationTtl: NEWS_FEED_CACHE_TTL,
    });
  } catch {
    /* non-critical */
  }

  return noCacheJsonResponse(response);
}

// ─── GET /api/news/trending — Trending Stories ──────────────────────────

export async function handleNewsTrending(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);

  const result = await aggregateNews(env, { limit: limit * 2, sort: 'trending' });

  // Re-sort by velocity for trending
  const trending = result.stories
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary.slice(0, 150),
      url: s.url,
      source: s.source,
      author: s.author,
      publishedAt: s.publishedAt,
      velocity: s.velocity,
      sentiment: s.sentiment,
      imageUrl: s.imageUrl,
      niches: s.niches,
      alsoCoveredBy: s.alsoCoveredBy,
    }));

  return noCacheJsonResponse({
    data: trending,
    meta: {
      total: trending.length,
      fetchedAt: Date.now(),
      trending: result.meta.trending,
    },
  });
}

// ─── GET /api/news/category/:category — News by Category ────────────────

export async function handleNewsCategory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const category = url.pathname.split('/').pop() || '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 200);

  if (!ALLOWED_NICHES.has(category)) {
    return jsonResponse({ error: `Unknown category: ${category}` }, 400);
  }

  const result = await aggregateNews(env, { category, limit });
  const classifications = classifyStories(result.stories);

  return noCacheJsonResponse({
    data: result.stories.map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary.slice(0, 200),
      url: s.url,
      source: s.source,
      author: s.author,
      publishedAt: s.publishedAt,
      sentiment: s.sentiment,
      entities: s.entities,
      imageUrl: s.imageUrl,
      niches: s.niches,
      categories: s.categories,
      score: s.score,
    })),
    meta: {
      category,
      total: result.stories.length,
      fetchedAt: result.meta.fetchedAt,
      topCategories: getTopCategories(classifications, 5),
    },
  });
}

// ─── GET /api/news/story/:storyId — Story Detail ────────────────────────

export async function handleNewsStory(request: Request, env: Env): Promise<Response> {
  const storyId = request.url.split('/').pop() || '';
  if (!storyId) {
    return jsonResponse({ error: 'Story ID required' }, 400);
  }

  // Fetch full aggregation to find the story
  const result = await aggregateNews(env, { limit: 100 });

  const story = result.stories.find((s) => s.id === storyId);
  if (!story) {
    return jsonResponse({ error: 'Story not found' }, 404);
  }

  // Find related stories (same cluster or same categories)
  const cluster = result.clusters.find((c) => c.stories.some((s) => s.id === storyId));
  const relatedStories = cluster
    ? cluster.stories.filter((s) => s.id !== storyId).slice(0, 5)
    : result.stories
        .filter((s) => s.id !== storyId && s.categories.some((c) => story.categories.includes(c)))
        .slice(0, 5);

  return noCacheJsonResponse({
    data: {
      id: story.id,
      title: story.title,
      summary: story.summary,
      body: story.body,
      url: story.url,
      source: story.source,
      sourceMeta: story.sourceMeta,
      author: story.author,
      publishedAt: story.publishedAt,
      imageUrl: story.imageUrl,
      categories: story.categories,
      niches: story.niches,
      sentiment: story.sentiment,
      entities: story.entities,
      alsoCoveredBy: story.alsoCoveredBy,
      allUrls: story.allUrls,
      isBreaking: story.isBreaking,
      score: story.score,
    },
    related: relatedStories.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      source: s.source,
      publishedAt: s.publishedAt,
      score: s.score,
    })),
    meta: {
      fetchedAt: Date.now(),
      totalRelated: relatedStories.length,
    },
  });
}

// ─── GET /api/news/search — Search News Archives ────────────────────────

export async function handleNewsSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 100);
  const category = url.searchParams.get('category') || '';

  if (!q) {
    return jsonResponse({ error: 'Search query required' }, 400);
  }

  const result = await aggregateNews(env, { query: q, category, limit });

  return noCacheJsonResponse({
    data: result.stories.map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary.slice(0, 200),
      url: s.url,
      source: s.source,
      author: s.author,
      publishedAt: s.publishedAt,
      sentiment: s.sentiment,
      imageUrl: s.imageUrl,
      niches: s.niches,
      score: s.score,
    })),
    meta: {
      query: q,
      category: category || 'all',
      total: result.stories.length,
      fetchedAt: Date.now(),
    },
  });
}

// ─── GET /api/news/sources — All News Sources ───────────────────────────

export async function handleNewsSources(_request: Request, env: Env): Promise<Response> {
  const sources = NEWS_SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    tier: s.tier,
    credibility: s.credibility,
    weight: s.weight,
    type: s.type,
  }));

  // Count stories per source (cached)
  let sourceCounts: Record<string, number> = {};
  try {
    const cached = await env.CACHE?.get(NEWS_SOURCES_CACHE_KEY);
    if (cached) {
      sourceCounts = JSON.parse(cached);
    } else {
      // Build counts from recent aggregation
      const result = await aggregateNews(env, { limit: 100 });
      sourceCounts = {};
      for (const story of result.stories) {
        sourceCounts[story.sourceMeta.id] = (sourceCounts[story.sourceMeta.id] ?? 0) + 1;
      }
      await env.CACHE?.put(NEWS_SOURCES_CACHE_KEY, JSON.stringify(sourceCounts), {
        expirationTtl: NEWS_SOURCES_CACHE_TTL,
      });
    }
  } catch {
    /* non-critical */
  }

  return noCacheJsonResponse({
    data: sources.map((s) => ({
      ...s,
      recentStoryCount: sourceCounts[s.id] ?? 0,
    })),
    meta: {
      total: sources.length,
      fetchedAt: Date.now(),
    },
  });
}

// ─── POST /api/news/preferences — Update News Preferences ────────────────

export async function handleNewsPreferences(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: {
    wallet?: string;
    topicWeights?: Record<string, number>;
    sourceBoosts?: Record<string, number>;
    mutedCategories?: string[];
    mutedSources?: string[];
    depthPreference?: string;
    discoveryRatio?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const wallet = body.wallet || '';
  if (!wallet) {
    return jsonResponse({ error: 'Wallet address required' }, 400);
  }

  // Load existing prefs, merge, save
  const key = `user:news_prefs:${wallet.toLowerCase()}`;
  let existing: Partial<NewsPreferences> = {};
  try {
    const raw = await env.CACHE?.get(key);
    if (raw) existing = JSON.parse(raw);
  } catch {
    /* non-critical */
  }

  const updated: Partial<NewsPreferences> = {
    ...existing,
    ...(body.topicWeights
      ? { topicWeights: { ...existing.topicWeights, ...body.topicWeights } }
      : {}),
    ...(body.sourceBoosts
      ? { sourceBoosts: { ...existing.sourceBoosts, ...body.sourceBoosts } }
      : {}),
    ...(body.mutedCategories ? { mutedCategories: body.mutedCategories } : {}),
    ...(body.mutedSources ? { mutedSources: body.mutedSources } : {}),
    ...(body.depthPreference
      ? { depthPreference: body.depthPreference as NewsPreferences['depthPreference'] }
      : {}),
    ...(body.discoveryRatio !== undefined ? { discoveryRatio: body.discoveryRatio } : {}),
  };

  try {
    await env.CACHE?.put(key, JSON.stringify(updated), {
      expirationTtl: 60 * 60 * 24 * 400,
    });
  } catch {
    /* non-critical */
  }

  return jsonResponse({
    ok: true,
    wallet,
    preferences: updated,
  });
}

// ─── GET /api/news/digest/preview — Preview Today's Digest ──────────────

export async function handleNewsDigestPreview(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'json';
  const nichesParam = url.searchParams.get('niches') || '';
  const niches = nichesParam
    .split(',')
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);

  // Cache per 5-min bucket
  const fiveMin = Math.floor(Date.now() / 300000);
  const cacheKey = `news:digest:preview:v1:${niches.join(',') || 'all'}:${fiveMin}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached && format === 'json') {
      return noCacheJsonResponse(JSON.parse(cached));
    }
  } catch {
    /* cache miss */
  }

  // Aggregate
  const result = await aggregateNews(env, { limit: 50, category: niches[0] || '' });
  const classifications = classifyStories(result.stories);

  // Pick featured story (highest score + breaking)
  const featured = result.stories.slice(0, 1).map((s) => ({
    id: s.id,
    title: s.title,
    summary: s.summary.slice(0, 200),
    url: s.url,
    source: s.source,
    author: s.author,
    publishedAt: s.publishedAt,
    imageUrl: s.imageUrl,
    sentiment: s.sentiment,
    niches: s.niches,
  }));

  // Build digest sections
  const sections = [
    {
      title: 'Market Update',
      stories: result.stories
        .filter((s) => s.categories.some((c) => ['markets', 'macro', 'bitcoin'].includes(c)))
        .slice(0, 3)
        .map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          source: s.source,
          sentiment: s.sentiment.label,
        })),
    },
    {
      title: 'Top Stories',
      stories: result.stories.slice(0, 10).map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary.slice(0, 120),
        url: s.url,
        source: s.source,
        author: s.author,
        publishedAt: s.publishedAt,
        sentiment: s.sentiment,
        niches: s.niches.slice(0, 3),
        isBreaking: s.isBreaking,
      })),
    },
    {
      title: 'Trending Topics',
      topics: result.meta.trending.slice(0, 8),
    },
    {
      title: 'On This Day',
      // Placeholder — retroactive lookup would be archival
      stories: result.stories
        .filter((s) => s.score > 8)
        .slice(0, 3)
        .map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          source: s.source,
        })),
    },
  ];

  // Generate auto subject line
  const topCategory = getTopCategories(classifications, 1)[0];
  const topToken = result.stories[0]?.entities?.tokens?.[0] || '';
  const subjectLine = topToken
    ? `${topToken} ${result.meta.sentiment.bullish > result.meta.sentiment.bearish ? 'surges' : 'dips'} — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
    : `DegenFeed Daily — ${new Date().toDateString()}`;

  const response = {
    subject: subjectLine,
    featured: featured[0] || null,
    sections,
    meta: {
      ...result.meta,
      topCategory: topCategory || null,
      generatedAt: Date.now(),
      readTimeMinutes: Math.ceil(
        result.stories
          .slice(0, 10)
          .reduce((sum, s) => sum + Math.ceil(s.body.split(/\s+/).length / 200), 0) / 5,
      ),
    },
  };

  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
  } catch {
    /* non-critical */
  }

  return noCacheJsonResponse(response);
}

// ─── POST /api/news/digest/subscribe — Subscribe ────────────────────────

export async function handleNewsDigestSubscribe(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: { email?: string; niches?: string[]; frequency?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'Invalid email' }, 400);
  }

  const niches = Array.isArray(body.niches)
    ? body.niches.map((n) => n.toLowerCase()).filter((n) => ALLOWED_NICHES.has(n))
    : [];
  const frequency = body.frequency || 'daily';

  const record = { email, niches, frequency, subscribedAt: Date.now() };
  const key = `news:digest:sub:${safeKey(email)}`;
  const listKey = 'news:digest:subscribers';

  try {
    await env.CACHE?.put(key, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 400,
    });
    const idx = (await env.CACHE?.get(listKey)) ?? '';
    const set = new Set(idx.split('\n').filter(Boolean));
    set.add(safeKey(email));
    await env.CACHE?.put(listKey, [...set].join('\n'), {
      expirationTtl: 60 * 60 * 24 * 400,
    });
  } catch {
    /* non-critical */
  }

  return jsonResponse({
    ok: true,
    email,
    niches,
    frequency,
    action: 'subscribed',
  });
}

// ─── GET /api/news/for-you — Ultra-Personalized Feed ─────────────────────

export async function handleNewsForYou(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const wallet = url.searchParams.get('wallet') || '';

  // Load reading history for personalization
  let profile: UserProfile | null = null;
  let prefs: NewsPreferences = { ...DEFAULT_PREFERENCES };
  if (wallet && env.CACHE) {
    try {
      const historyRaw = await env.CACHE.get(`user:news_history:${wallet.toLowerCase()}`);
      if (historyRaw) {
        const history = JSON.parse(historyRaw) as ReadHistoryEntry[];
        profile = inferUserProfile(history);
        // Boost history-weighted topics
        for (const [catId, weight] of Object.entries(profile.topicWeights)) {
          if (prefs.topicWeights[catId] !== undefined) {
            prefs.topicWeights[catId] = Math.min(100, prefs.topicWeights[catId] + weight * 0.5);
          }
        }
      }
    } catch { /* non-critical */ }
  }

  const result = await aggregateNews(env, { limit: limit * 2 });
  const personalized = personalizeNewsFeed(result.stories, prefs, profile);

  return noCacheJsonResponse({
    data: personalized.slice(0, limit).map((s) => ({
      id: s.id, title: s.title, summary: s.summary, url: s.url,
      source: s.source, author: s.authorName || s.author, publishedAt: s.publishedAt,
      imageUrl: s.imageUrl, heroImage: s.heroImage, categories: s.categories,
      niches: s.niches, sentiment: s.sentiment, entities: s.entities,
      alsoCoveredBy: s.alsoCoveredBy, isBreaking: s.isBreaking, score: s.score,
      readingTime: s.readingTime, scoreComponents: s.scoreComponents,
    })),
    meta: { total: personalized.length, personalized: true, fetchedAt: Date.now() },
  });
}

// ─── GET /api/news/hot — Breaking/Trending (velocity > threshold) ────────

export async function handleNewsHot(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);

  const result = await aggregateNews(env, { limit: 100, sort: 'trending' });
  const hot = result.stories
    .filter((s) => s.isBreaking || s.velocity > 1.5)
    .slice(0, limit)
    .map((s) => ({
      id: s.id, title: s.title, summary: s.summary.slice(0, 150), url: s.url,
      source: s.source, publishedAt: s.publishedAt, velocity: s.velocity,
      imageUrl: s.imageUrl, heroImage: s.heroImage, isBreaking: s.isBreaking,
      alsoCoveredBy: s.alsoCoveredBy, sentiment: s.sentiment, readingTime: s.readingTime,
    }));

  return noCacheJsonResponse({
    data: hot,
    meta: { total: hot.length, fetchedAt: Date.now(), threshold: 'velocity > 1.5' },
  });
}

// ─── GET /api/news/deep-dives — Long-Form Analysis (> 2000 words) ────────

export async function handleNewsDeepDives(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
  const category = url.searchParams.get('category') || '';

  const result = await aggregateNews(env, { limit: 100, category });
  const deepDives = result.stories
    .filter((s) => (s.body?.split(/\s+/).length ?? 0) > 2000)
    .slice(0, limit)
    .map((s) => ({
      id: s.id, title: s.title, summary: s.summary.slice(0, 300), url: s.url,
      source: s.source, author: s.authorName || s.author, publishedAt: s.publishedAt,
      imageUrl: s.imageUrl, heroImage: s.heroImage, readingTime: s.readingTime,
      wordCount: s.body?.split(/\s+/).length ?? 0, entities: s.entities,
      sentiment: s.sentiment, categories: s.categories, niches: s.niches,
    }));

  return noCacheJsonResponse({
    data: deepDives,
    meta: { total: deepDives.length, category: category || 'all', fetchedAt: Date.now() },
  });
}

// ─── GET /api/news/quick-reads — Short News (< 500 words) ────────────────

export async function handleNewsQuickReads(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);

  const result = await aggregateNews(env, { limit: 100 });
  const quickReads = result.stories
    .filter((s) => (s.body?.split(/\s+/).length ?? 0) < 500)
    .slice(0, limit)
    .map((s) => ({
      id: s.id, title: s.title, summary: s.summary.slice(0, 150), url: s.url,
      source: s.source, author: s.authorName || s.author, publishedAt: s.publishedAt,
      imageUrl: s.imageUrl, readingTime: s.readingTime, sentiment: s.sentiment,
      niches: s.niches,
    }));

  return noCacheJsonResponse({
    data: quickReads,
    meta: { total: quickReads.length, fetchedAt: Date.now() },
  });
}

// ─── GET /api/news/protocol/:protocol — Protocol-Specific News ──────────

export async function handleNewsProtocol(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const protocol = url.pathname.split('/').pop() || '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 100);

  const result = await aggregateNews(env, { limit: 100 });
  const protocolStories = result.stories
    .filter(
      (s) =>
        s.entities.protocols.includes(protocol.toLowerCase()) ||
        s.categories.includes(protocol.toLowerCase()),
    )
    .slice(0, limit)
    .map((s) => ({
      id: s.id, title: s.title, url: s.url, source: s.source,
      publishedAt: s.publishedAt, summary: s.summary.slice(0, 200),
      imageUrl: s.imageUrl, sentiment: s.sentiment, entities: s.entities,
      score: s.score,
    }));

  return noCacheJsonResponse({
    data: protocolStories,
    meta: { protocol, total: protocolStories.length, fetchedAt: Date.now() },
  });
}

// ─── GET /api/news/token/:token — Token-Specific News ($BTC, $ETH) ─────

export async function handleNewsToken(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.pathname.split('/').pop()?.toUpperCase() || '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 100);

  if (!token) {
    return jsonResponse({ error: 'Token symbol required' }, 400);
  }

  const result = await aggregateNews(env, { limit: 100 });
  const tokenStories = result.stories
    .filter((s) => s.entities.tokens.includes(token))
    .slice(0, limit)
    .map((s) => ({
      id: s.id, title: s.title, url: s.url, source: s.source,
      publishedAt: s.publishedAt, summary: s.summary.slice(0, 200),
      imageUrl: s.imageUrl, sentiment: s.sentiment, entities: s.entities,
      score: s.score,
    }));

  return noCacheJsonResponse({
    data: tokenStories,
    meta: { token, total: tokenStories.length, fetchedAt: Date.now() },
  });
}

// ─── GET /api/news/author/:author — Articles by Author ──────────────────

export async function handleNewsAuthor(request: Request, env: Env): Promise<Response> {
  const authorSlug = request.url.split('/').pop() || '';
  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 20, 100);

  if (!authorSlug) {
    return jsonResponse({ error: 'Author name required' }, 400);
  }

  const result = await aggregateNews(env, { limit: 100 });
  const authorLower = authorSlug.replace(/-/g, ' ').toLowerCase();
  const authorStories = result.stories
    .filter(
      (s) =>
        s.authorName?.toLowerCase().includes(authorLower) ||
        s.author?.toLowerCase().includes(authorLower),
    )
    .slice(0, limit)
    .map((s) => ({
      id: s.id, title: s.title, url: s.url, source: s.source,
      author: s.authorName || s.author, publishedAt: s.publishedAt,
      summary: s.summary.slice(0, 200), imageUrl: s.imageUrl,
      sentiment: s.sentiment, score: s.score,
    }));

  return noCacheJsonResponse({
    data: authorStories,
    meta: { author: authorSlug, total: authorStories.length, fetchedAt: Date.now() },
  });
}

// ─── POST /api/news/mark-read — Mark Article as Read ────────────────────

export async function handleNewsMarkRead(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: { wallet?: string; storyId?: string; dwellTimeMs?: number; engaged?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const wallet = body.wallet || '';
  const storyId = body.storyId || '';
  if (!wallet || !storyId) {
    return jsonResponse({ error: 'Wallet and storyId required' }, 400);
  }

  const entry: ReadHistoryEntry = {
    storyId,
    categoryId: 'crypto',
    sourceId: '',
    readAt: Date.now(),
    dwellTimeMs: body.dwellTimeMs ?? 30000,
    engaged: body.engaged ?? false,
  };

  const historyKey = `user:news_history:${wallet.toLowerCase()}`;
  try {
    const existing = await env.CACHE?.get(historyKey);
    const history: ReadHistoryEntry[] = existing ? JSON.parse(existing) : [];
    history.push(entry);
    // Keep last 500 entries
    const trimmed = history.slice(-500);
    await env.CACHE?.put(historyKey, JSON.stringify(trimmed), {
      expirationTtl: 60 * 60 * 24 * 90,
    });
  } catch { /* non-critical */ }

  return jsonResponse({ ok: true, storyId, action: 'marked_read' });
}

// ─── GET /api/news/reading-list — User's Reading List ───────────────────

export async function handleReadingList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet') || '';

  if (!wallet) {
    return jsonResponse({ error: 'Wallet address required' }, 400);
  }

  try {
    const raw = await env.CACHE?.get(`user:reading_list:${wallet.toLowerCase()}`);
    const storyIds: string[] = raw ? JSON.parse(raw) : [];

    if (storyIds.length === 0) {
      return noCacheJsonResponse({ data: [], meta: { total: 0, fetchedAt: Date.now() } });
    }

    // Fetch full aggregation to find saved stories
    const result = await aggregateNews(env, { limit: 100 });
    const savedStories = result.stories
      .filter((s) => storyIds.includes(s.id))
      .map((s) => ({
        id: s.id, title: s.title, summary: s.summary.slice(0, 200), url: s.url,
        source: s.source, author: s.authorName || s.author, publishedAt: s.publishedAt,
        imageUrl: s.imageUrl, heroImage: s.heroImage, readingTime: s.readingTime,
        sentiment: s.sentiment, entities: s.entities, score: s.score,
      }));

    return noCacheJsonResponse({
      data: savedStories,
      meta: { total: savedStories.length, fetchedAt: Date.now() },
    });
  } catch {
    return jsonResponse({ error: 'Failed to load reading list' }, 500);
  }
}

// ─── POST /api/news/reading-list/:id — Add/Remove from Reading List ─────

export async function handleReadingListToggle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const storyId = pathParts[pathParts.length - 1] || '';
  const wallet = url.searchParams.get('wallet') || '';

  // Also allow POST body
  let bodyWallet = '';
  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as { wallet?: string };
      bodyWallet = body.wallet || '';
    } catch { /* ignore */ }
  }

  const effectiveWallet = wallet || bodyWallet;
  if (!effectiveWallet || !storyId) {
    return jsonResponse({ error: 'Wallet and story ID required' }, 400);
  }

  const listKey = `user:reading_list:${effectiveWallet.toLowerCase()}`;
  try {
    const raw = await env.CACHE?.get(listKey);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const idx = list.indexOf(storyId);
    let action: 'added' | 'removed';

    if (idx >= 0) {
      list.splice(idx, 1);
      action = 'removed';
    } else {
      list.push(storyId);
      action = 'added';
    }

    await env.CACHE?.put(listKey, JSON.stringify(list), {
      expirationTtl: 60 * 60 * 24 * 400,
    });

    return jsonResponse({
      ok: true,
      storyId,
      action,
      totalItems: list.length,
    });
  } catch {
    return jsonResponse({ error: 'Failed to update reading list' }, 500);
  }
}

// ─── Router ───────────────────────────────────────────────────────────────

export async function handleNewsRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Parse route path
  if (path === '/api/news/feed' || path === '/api/news') {
    return handleNewsFeed(request, env);
  }
  if (path === '/api/news/trending') {
    return handleNewsTrending(request, env);
  }
  if (path === '/api/news/search') {
    return handleNewsSearch(request, env);
  }
  if (path === '/api/news/sources') {
    return handleNewsSources(request, env);
  }
  if (path === '/api/news/preferences') {
    return handleNewsPreferences(request, env);
  }
  if (path === '/api/news/digest/preview') {
    return handleNewsDigestPreview(request, env);
  }
  if (path === '/api/news/digest/subscribe') {
    return handleNewsDigestSubscribe(request, env);
  }

  // ── New personalized endpoints ──
  if (path === '/api/news/for-you') {
    return handleNewsForYou(request, env);
  }
  if (path === '/api/news/hot') {
    return handleNewsHot(request, env);
  }
  if (path === '/api/news/deep-dives') {
    return handleNewsDeepDives(request, env);
  }
  if (path === '/api/news/quick-reads') {
    return handleNewsQuickReads(request, env);
  }
  if (path === '/api/news/mark-read') {
    return handleNewsMarkRead(request, env);
  }
  if (path === '/api/news/reading-list') {
    if (request.method === 'POST') {
      // POST to /api/news/reading-list without trailing ID — fallback
      return handleReadingList(request, env);
    }
    return handleReadingList(request, env);
  }
  if (path.startsWith('/api/news/reading-list/')) {
    return handleReadingListToggle(request, env);
  }

  // Protocol/token/author-specific
  if (path.startsWith('/api/news/protocol/')) {
    return handleNewsProtocol(request, env);
  }
  if (path.startsWith('/api/news/token/')) {
    return handleNewsToken(request, env);
  }
  if (path.startsWith('/api/news/author/')) {
    return handleNewsAuthor(request, env);
  }

  if (path.startsWith('/api/news/story/')) {
    return handleNewsStory(request, env);
  }
  if (path.startsWith('/api/news/category/')) {
    return handleNewsCategory(request, env);
  }

  // Default: feed
  return handleNewsFeed(request, env);
}
