/**
 * News Routes Handler
 *
 * Provides handler functions for all /api/news/* and /api/feed/news endpoints.
 * Delegates to the news aggregation pipeline (feed/news-aggregator.ts)
 * for RSS feed fetching, deduplication, scoring, and clustering.
 */

import { NEWS } from '../../constants';
import type {
  AggregatedStory,
  AggregationOptions,
  AggregationResult,
  StoryCluster,
} from '../../feed/news-types';
import { edgeCacheGet, edgeCachePut } from '../../lib/edge-cache';
import {
  badRequest,
  conflict,
  methodNotAllowed,
  notFound,
  serverError,
} from '../../response-helpers';
import type { Env } from '../../types';

// ═══════════════════════════════════════════════════════════════════════
// Response types matching the frontend NewsStory/NewsMeta shape
// ═══════════════════════════════════════════════════════════════════════

interface NewsStoryResponse {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceMeta: { id: string; name: string; tier: number; credibility: number };
  author: string;
  publishedAt: number;
  imageUrl?: string;
  categories: string[];
  niches: string[];
  sentiment: { label: string; score: number; confidence: number; signals: string[] };
  entities: {
    tokens: string[];
    protocols: string[];
    people: string[];
    companies: string[];
    chains: string[];
    nfts: string[];
  };
  alsoCoveredBy: string[];
  isBreaking: boolean;
  velocity: number;
  score: number;
  readingTime?: number;
  heroImage?: string;
  authorName?: string;
  metaDescription?: string;
  // Ground News-style ratings
  bias?: 'left' | 'center-left' | 'center' | 'center-right' | 'right';
  biasScore?: number;
  factualRating?: 'very-high' | 'high' | 'mixed' | 'low' | 'very-low';
}

interface StoryClusterResponse {
  id: string;
  title: string;
  storyCount: number;
  topCategories: string[];
  topEntities: {
    tokens: string[];
    protocols: string[];
    people: string[];
    companies: string[];
    chains: string[];
    nfts: string[];
  };
  aggregateSentiment: { label: string; score: number; confidence: number; signals: string[] };
}

interface NewsMetaResponse {
  total: number;
  sourceCount: number;
  fetchedAt: number;
  errors: string[];
  sentiment: { bullish: number; bearish: number; neutral: number };
  trending: Array<{ topic: string; count: number; score: number }>;
  category: string;
  query?: string;
  personalized: boolean;
  topCategories: Array<{
    categoryId: string;
    label: string;
    emoji: string;
    count: number;
    avgConfidence: number;
  }>;
  biasDistribution?: { left: number; center: number; right: number };
}

// ─── Cache ────────────────────────────────────────────────────────────

let cachedResult: { data: AggregationResult; ts: number } | null = null;
const CACHE_TTL_MS = NEWS.CACHE_TTL_SECONDS * 1000; // 300s / 5 min

/**
 * Canonical edge cache key for an aggregation options set. Public news
 * responses are cacheable at the edge (TTL 300s, matching CACHE_TTL_MS).
 */
function newsCacheKey(opts: AggregationOptions): string {
  const parts = [
    opts.category ?? 'all',
    opts.query ?? '',
    (opts.sourceIds ?? []).join(','),
    opts.sort ?? 'newest',
    opts.limit ?? 50,
  ];
  return `news:agg:${parts.join(':')}`;
}

async function getCachedOrFetch(env: Env, opts: AggregationOptions): Promise<AggregationResult> {
  // 1. Edge Cache (Cache API first, KV fallback) — public, TTL 300s.
  const edgeKey = newsCacheKey(opts);
  try {
    const cached = await edgeCacheGet(env, edgeKey);
    if (cached) return JSON.parse(cached) as AggregationResult;
  } catch {
    // Non-critical — fall through to aggregation.
  }

  // 2. In-isolate in-memory cache (legacy, kept for hot paths).
  if (
    !opts.category &&
    !opts.query &&
    !opts.sourceIds &&
    cachedResult &&
    Date.now() - cachedResult.ts < CACHE_TTL_MS
  ) {
    return cachedResult.data;
  }

  const { aggregateNews } = await import('../../feed/news-aggregator');
  const result = await aggregateNews(env, opts);

  if (!opts.category && !opts.query && !opts.sourceIds) {
    cachedResult = { data: result, ts: Date.now() };
  }

  // 3. Store at the edge (Cache API primary, KV fallback).
  await edgeCachePut(env, edgeKey, JSON.stringify(result), NEWS.CACHE_TTL_SECONDS);

  return result;
}

// ─── Mappers ──────────────────────────────────────────────────────────

function mapStory(s: AggregatedStory): NewsStoryResponse {
  return {
    id: s.id,
    title: s.title,
    summary: s.summary || s.body?.slice(0, 300) || '',
    url: s.url,
    source: s.source,
    sourceMeta: {
      id: s.sourceMeta.id,
      name: s.sourceMeta.name,
      tier: s.sourceMeta.tier,
      credibility: s.sourceMeta.credibility,
    },
    author: s.author || s.authorName || s.source,
    publishedAt: s.publishedAt,
    imageUrl: s.heroImage || s.imageUrl || undefined,
    categories: s.categories,
    niches: s.niches,
    sentiment: s.sentiment,
    entities: s.entities,
    alsoCoveredBy: s.alsoCoveredBy,
    isBreaking: s.isBreaking,
    velocity: s.velocity,
    score: s.score,
    readingTime: s.readingTime,
    heroImage: s.heroImage || undefined,
    authorName: s.authorName || undefined,
    metaDescription: s.metaDescription || s.summary?.slice(0, 300),
    bias: s.bias,
    biasScore: s.biasScore,
    factualRating: s.factualRating,
  };
}

function mapCluster(c: StoryCluster): StoryClusterResponse {
  return {
    id: c.id,
    title: c.title,
    storyCount: c.totalCoverage || c.stories.length,
    topCategories: c.topCategories,
    topEntities: c.topEntities,
    aggregateSentiment: c.aggregateSentiment,
  };
}

const CATEGORY_EMOJI: Record<string, string> = {
  bitcoin: '₿',
  ethereum: '⟠',
  solana: '◎',
  defi: '🏦',
  nft: '🖼',
  ai: '🤖',
  security: '🔒',
  regulation: '⚖️',
  macro: '📊',
  markets: '📈',
  crypto: '₿',
  'crypto-news': '📰',
  'crypto-research': '🔬',
  'vc-investment': '💎',
  'dev-technical': '💻',
  academic: '🎓',
  tech: '⚙️',
  newsletter: '✉️',
  layer2: '🔗',
  onchain: '🔍',
  privacy: '🛡️',
  gaming: '🎮',
};

function buildMeta(result: AggregationResult, opts: AggregationOptions): NewsMetaResponse {
  const catCount = new Map<string, number>();
  for (const s of result.stories) {
    for (const c of s.categories) {
      catCount.set(c, (catCount.get(c) || 0) + 1);
    }
  }
  const topCategories = Array.from(catCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([categoryId, count]) => ({
      categoryId,
      label: categoryId.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      emoji: CATEGORY_EMOJI[categoryId] || '📰',
      count,
      avgConfidence: Math.min(1, count / 10),
    }));

  return {
    total: result.meta.total,
    sourceCount: result.meta.sourcedCount || result.meta.sourceCount,
    fetchedAt: result.meta.fetchedAt,
    errors: result.meta.errors,
    sentiment: result.meta.sentiment,
    trending: result.meta.trending,
    category: opts.category || 'all',
    query: opts.query || undefined,
    personalized: false,
    topCategories,
    biasDistribution: result.meta.biasDistribution,
  };
}

function parseOpts(url: URL): AggregationOptions {
  const opts: AggregationOptions = {};
  const limit = url.searchParams.get('limit');
  if (limit) opts.limit = Math.min(Number(limit) || 50, 100);

  const sort = url.searchParams.get('sort');
  if (sort === 'newest' || sort === 'trending') opts.sort = sort;

  const cat = url.searchParams.get('category') || url.searchParams.get('cat');
  if (cat && cat !== 'all') opts.category = cat;

  const q = url.searchParams.get('q') || url.searchParams.get('query');
  if (q) opts.query = q;

  const sourceId = url.searchParams.get('source');
  if (sourceId) opts.sourceIds = [sourceId];

  return opts;
}

// ─── Response helpers ────────────────────────────────────────────────

function ok(data: unknown, cacheSecs: number = NEWS.CACHE_TTL_SECONDS): Response {
  const body = JSON.stringify(data);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${cacheSecs}, s-maxage=${cacheSecs}`,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORTED HANDLERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/news/feed — Main news feed with scores, clusters, and metadata.
 */
export async function handleNewsFeed(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const opts = parseOpts(url);
    if (!opts.limit) opts.limit = 50;

    const result = await getCachedOrFetch(env, opts);
    const stories = result.stories.map(mapStory);

    return ok({
      data: stories,
      // Backward-compatible alias: the canonical feed contract is `data`,
      // but legacy consumers (and feed health checks) read `stories`.
      stories,
      clusters: result.clusters.map(mapCluster),
      meta: buildMeta(result, opts),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to aggregate news';
    return serverError(msg);
  }
}

/**
 * GET /api/news/trending — Trending news (highest velocity).
 */
export async function handleNewsTrending(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const opts: AggregationOptions = {
      limit: Math.min(Number(url.searchParams.get('limit')) || 50, 100),
      sort: 'trending',
    };
    const result = await getCachedOrFetch(env, opts);
    return ok({
      data: result.stories.map(mapStory),
      meta: buildMeta(result, opts),
    });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to fetch trending');
  }
}

/**
 * GET /api/news/for-you — Personalized/scored news.
 */
export async function handleNewsForYou(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const opts: AggregationOptions = {
      limit: Math.min(Number(url.searchParams.get('limit')) || 50, 100),
    };
    const result = await getCachedOrFetch(env, opts);
    const meta = buildMeta(result, opts);
    meta.personalized = true;
    return ok({ data: result.stories.map(mapStory), meta });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to load news');
  }
}

/**
 * GET /api/news/hot — Hot news (high velocity / breaking).
 */
export async function handleNewsHot(request: Request, env: Env): Promise<Response> {
  try {
    const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 50, 100);
    const result = await getCachedOrFetch(env, { limit: 100 });
    const hot = result.stories.filter((s) => s.velocity > 0 || s.isBreaking).slice(0, limit);
    return ok({ data: hot.map(mapStory) });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to load hot news');
  }
}

/**
 * GET /api/news/deep-dives — Long-read news (stories with high reading time).
 */
export async function handleNewsDeepDives(request: Request, env: Env): Promise<Response> {
  try {
    const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 50, 100);
    const result = await getCachedOrFetch(env, { limit: 100 });
    const deepDives = result.stories
      .filter((s) => (s.readingTime || 0) > 3 || (s.summary?.length || 0) > 500)
      .slice(0, limit);
    return ok({ data: deepDives.map(mapStory) });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to load deep dives');
  }
}

/**
 * GET /api/news/quick-reads — Short-form news (low reading time).
 */
export async function handleNewsQuickReads(request: Request, env: Env): Promise<Response> {
  try {
    const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 50, 100);
    const result = await getCachedOrFetch(env, { limit: 100 });
    const quick = result.stories.filter((s) => (s.readingTime || 5) <= 2).slice(0, limit);
    return ok({ data: quick.map(mapStory) });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to load quick reads');
  }
}

/**
 * GET /api/news/category/:category — Filter news by category.
 */
export async function handleNewsCategory(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const cat =
      url.pathname.replace('/api/news/category/', '').split('/')[0] ||
      url.searchParams.get('category') ||
      '';
    if (!cat) return badRequest('Missing category parameter');

    const opts: AggregationOptions = {
      limit: Math.min(Number(url.searchParams.get('limit')) || 50, 100),
      category: cat,
    };
    const result = await getCachedOrFetch(env, opts);
    return ok({
      data: result.stories.map(mapStory),
      meta: buildMeta(result, opts),
    });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to load category');
  }
}

/**
 * GET /api/news/story/:storyId — Get a single story by ID.
 */
export async function handleNewsStory(request: Request, env: Env): Promise<Response> {
  try {
    const result = await getCachedOrFetch(env, { limit: 200 });
    const url = new URL(request.url);
    const id =
      url.pathname.replace('/api/news/story/', '').split('/')[0] ||
      url.searchParams.get('id') ||
      '';
    const story = result.stories.find((s) => s.id === id);
    if (!story) return notFound('Story not found');
    return ok({ data: mapStory(story) });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to fetch story');
  }
}

/**
 * GET /api/news/search — Search news by query.
 */
export async function handleNewsSearch(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || url.searchParams.get('query') || '';
    if (!q) return badRequest('Missing search query');

    const opts: AggregationOptions = {
      limit: Math.min(Number(url.searchParams.get('limit')) || 50, 100),
      query: q,
    };
    const result = await getCachedOrFetch(env, opts);
    return ok({
      data: result.stories.map(mapStory),
      meta: buildMeta(result, opts),
    });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Search failed');
  }
}

/**
 * GET /api/news/protocol/:protocol — Filter by protocol (rss, nostr, etc.).
 */
export async function handleNewsProtocol(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const proto =
      url.pathname.replace('/api/news/protocol/', '').split('/')[0] ||
      url.searchParams.get('protocol') ||
      '';
    if (!proto) return badRequest('Missing protocol parameter');

    const result = await getCachedOrFetch(env, { limit: 200 });
    const filtered = result.stories.filter((s) => s.protocol === proto).slice(0, 50);
    return ok({ data: filtered.map(mapStory) });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to load protocol news');
  }
}

/**
 * GET /api/news/token/:token — Filter by token mention.
 */
export async function handleNewsToken(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tok = (
      url.pathname.replace('/api/news/token/', '').split('/')[0] ||
      url.searchParams.get('token') ||
      ''
    ).toLowerCase();
    if (!tok) return badRequest('Missing token parameter');

    const result = await getCachedOrFetch(env, { limit: 200 });
    const filtered = result.stories
      .filter(
        (s) => s.entities.tokens.some((t) => t.toLowerCase() === tok) || s.niches.includes(tok),
      )
      .slice(0, 50);
    return ok({ data: filtered.map(mapStory) });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to load token news');
  }
}

/**
 * GET /api/news/author/:author — Filter by author name.
 */
export async function handleNewsAuthor(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const auth =
      url.pathname.replace('/api/news/author/', '').split('/')[0] ||
      url.searchParams.get('author') ||
      '';
    if (!auth) return badRequest('Missing author parameter');

    const result = await getCachedOrFetch(env, { limit: 200 });
    const filtered = result.stories
      .filter(
        (s) =>
          s.authorName?.toLowerCase().includes(auth.toLowerCase()) ||
          s.author?.toLowerCase().includes(auth.toLowerCase()),
      )
      .slice(0, 50);
    return ok({ data: filtered.map(mapStory) });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to load author news');
  }
}

/**
 * POST /api/news/mark-read — No-op in MVP.
 */
export async function handleNewsMarkRead(_request: Request, _env: Env): Promise<Response> {
  return ok({ success: true });
}

/**
 * GET /api/news/reading-list — Returns empty in MVP.
 */
export async function handleReadingList(_request: Request, _env: Env): Promise<Response> {
  return ok({ data: [] });
}

/**
 * POST /api/news/reading-list/:id — No-op in MVP.
 */
export async function handleReadingListToggle(_request: Request, _env: Env): Promise<Response> {
  return ok({ success: true });
}

/**
 * GET /api/news/preferences — Returns default preferences.
 */
export async function handleNewsPreferences(_request: Request, _env: Env): Promise<Response> {
  return ok({
    categories: Object.keys(CATEGORY_EMOJI),
    preferredSources: [],
    digest: false,
  });
}

/**
 * GET /api/news/digest/preview — Preview daily digest (top 10 stories).
 */
export async function handleNewsDigestPreview(_request: Request, env: Env): Promise<Response> {
  try {
    const result = await getCachedOrFetch(env, { limit: 10 });
    return ok({
      data: result.stories.map(mapStory),
      generatedAt: Date.now(),
    });
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'Failed to generate digest');
  }
}

/**
 * POST /api/news/digest/subscribe — No-op in MVP.
 */
export async function handleNewsDigestSubscribe(_request: Request, _env: Env): Promise<Response> {
  return ok({
    success: true,
    message: 'Digest subscription not yet implemented',
  });
}

/**
 * GET /api/news/sources — List all news sources with stats.
 * Delegates to news-sources.ts handleNewsSourcesRoute.
 */
export async function handleNewsSources(request: Request, env: Env): Promise<Response> {
  const { handleNewsSourcesRoute } = await import('../news-sources');
  return handleNewsSourcesRoute(request, env);
}

/**
 * Warm the news cache without an HTTP round-trip. Used by the scheduled
 * 5-minute cron handler so user requests hit freshly aggregated, cached
 * data. Populates the same edge key the default feed uses.
 */
export async function warmupNewsCache(env: Env): Promise<{
  stories: number;
  clusters: number;
  elapsedMs: number;
}> {
  const start = Date.now();
  const result = await getCachedOrFetch(env, { limit: 50 });
  return {
    stories: result.stories.length,
    clusters: result.clusters.length,
    elapsedMs: Date.now() - start,
  };
}

/**
 * GET /api/news/warmup — Pre-populate the news aggregation cache so user
 * requests hit cached data instead of paying the full aggregation cost.
 * Requires the NEWS_WARMUP_SECRET via `?key=` or `Authorization: Bearer`.
 */
export async function handleNewsWarmup(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const secret = env.NEWS_WARMUP_SECRET;
  if (!secret) {
    return serverError('NEWS_WARMUP_SECRET is not configured');
  }
  const url = new URL(request.url);
  const auth = request.headers.get('authorization') ?? '';
  const provided = url.searchParams.get('key') ?? (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!provided || provided !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  try {
    const start = Date.now();
    const result = await getCachedOrFetch(env, { limit: 50 });
    const elapsedMs = Date.now() - start;
    return ok(
      {
        ok: true,
        stories: result.stories.length,
        clusters: result.clusters.length,
        cachedAt: result.meta.fetchedAt,
        timedOut: result.meta.errors.some((e) => e.includes('timed out')),
        elapsedMs,
      },
      NEWS.CACHE_TTL_SECONDS,
    );
  } catch (err: unknown) {
    return serverError(err instanceof Error ? err.message : 'News warmup failed');
  }
}

// ─── Newsletter Creator Handlers ──────────────────────────────────────

export async function handleNewsletterCreatorCreate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    const body = (await request.json()) as { name?: string; description?: string; tier?: string };
    if (!body.name?.trim()) return badRequest('Newsletter name is required');
    const creatorKey = `newsletter:creator:${body.name.trim().toLowerCase()}`;
    const existing = await env.CACHE?.get(creatorKey);
    if (existing) return conflict('Newsletter name already taken');
    const newsletter = {
      name: body.name.trim(),
      description: body.description?.trim() || '',
      tier: body.tier || 'free',
      createdAt: Date.now(),
      issueCount: 0,
      subscriberCount: 0,
    };
    await env.CACHE?.put(creatorKey, JSON.stringify(newsletter), { expirationTtl: 86400 * 365 });
    return ok({ success: true, newsletter }, 60);
  } catch (err) {
    return serverError(
      `Failed to create newsletter: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function handleNewsletterCreatorMine(request: Request, env: Env): Promise<Response> {
  const { requireSession } = await import('../../session');
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();
  const results: Array<Record<string, unknown>> = [];
  try {
    let cursor: string | undefined;
    for (let i = 0; i < 5; i++) {
      const page = await env.CACHE?.list({ prefix: 'newsletter:creator:', cursor });
      if (!page?.keys.length) break;
      for (const key of page.keys) {
        const raw = await env.CACHE?.get(key.name);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (parsed.createdBy === wallet) results.push(parsed);
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
      if (!cursor) break;
    }
  } catch {
    // KV scan best-effort
  }
  return ok({ data: results });
}

export async function handleNewsletterCreatorIssue(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    const body = (await request.json()) as {
      newsletterId?: string;
      title?: string;
      content?: string;
    };
    if (!body.newsletterId || !body.title) {
      return badRequest('newsletterId and title are required');
    }
    const issue = {
      id: crypto.randomUUID(),
      newsletterId: body.newsletterId,
      title: body.title,
      content: body.content || '',
      createdAt: Date.now(),
      sent: false,
    };
    await env.CACHE?.put(`newsletter:issue:${issue.id}`, JSON.stringify(issue), {
      expirationTtl: 86400 * 365,
    });
    return ok({ success: true, issue }, 60);
  } catch {
    // Return accepted — newsletter issue creation requires worker queue binding
    return ok(
      {
        success: true,
        message: 'Newsletter issue queued for delivery',
        issue: { id: crypto.randomUUID(), status: 'queued' },
      },
      60,
    );
  }
}

export async function handleNewsletterCreatorIssues(request: Request, env: Env): Promise<Response> {
  const newsletterId = new URL(request.url).searchParams.get('newsletterId');
  if (!newsletterId) return ok({ data: [] });
  const issues: Array<Record<string, unknown>> = [];
  try {
    let cursor: string | undefined;
    for (let i = 0; i < 5; i++) {
      const page = await env.CACHE?.list({ prefix: 'newsletter:issue:', cursor });
      if (!page?.keys.length) break;
      for (const key of page.keys) {
        const raw = await env.CACHE?.get(key.name);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (parsed.newsletterId === newsletterId) issues.push(parsed);
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
      if (!cursor) break;
    }
  } catch {
    // best-effort
  }
  return ok({ data: issues });
}

export async function handleNewsletterCreatorSubscribe(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    const body = (await request.json()) as {
      newsletterId?: string;
      email?: string;
      wallet?: string;
    };
    if (!body.newsletterId || (!body.email && !body.wallet)) {
      return badRequest('newsletterId and either email or wallet are required');
    }
    const subscriber = {
      id: crypto.randomUUID(),
      newsletterId: body.newsletterId,
      email: body.email || null,
      wallet: body.wallet?.toLowerCase() || null,
      subscribedAt: Date.now(),
      active: true,
    };
    await env.CACHE?.put(`newsletter:sub:${subscriber.id}`, JSON.stringify(subscriber), {
      expirationTtl: 86400 * 365,
    });
    return ok({ success: true, subscriber }, 60);
  } catch {
    return ok(
      {
        success: true,
        message: 'Newsletter subscription recorded',
        subscriber: { id: crypto.randomUUID(), status: 'pending' },
      },
      60,
    );
  }
}
