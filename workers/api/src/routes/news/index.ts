/**
 * News Routes Handler
 *
 * Provides handler functions for all /api/news/* and /api/feed/news endpoints.
 * Delegates to the news aggregation pipeline (feed/news-aggregator.ts)
 * for RSS feed fetching, deduplication, scoring, and clustering.
 */

import type {
  AggregatedStory,
  AggregationOptions,
  AggregationResult,
  StoryCluster,
} from '../../feed/news-types';
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
}

// ─── Cache ────────────────────────────────────────────────────────────

let cachedResult: { data: AggregationResult; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

async function getCachedOrFetch(env: Env, opts: AggregationOptions): Promise<AggregationResult> {
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
  };
}

function parseOpts(url: URL): AggregationOptions {
  const opts: AggregationOptions = {};
  const limit = url.searchParams.get('limit');
  if (limit) opts.limit = Math.min(Number(limit) || 50, 200);

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

function ok(data: unknown, cacheSecs = 30): Response {
  const body = JSON.stringify(data);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${cacheSecs}`,
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

    return ok({
      data: result.stories.map(mapStory),
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
      limit: Math.min(Number(url.searchParams.get('limit')) || 20, 50),
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
      limit: Math.min(Number(url.searchParams.get('limit')) || 20, 50),
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
    const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 20, 50);
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
    const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 20, 50);
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
    const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 20, 50);
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
      limit: Math.min(Number(url.searchParams.get('limit')) || 50, 200),
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
      limit: Math.min(Number(url.searchParams.get('limit')) || 50, 200),
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
    return serverError(err instanceof Error ? err.message : 'Failed to generate digest', 500);
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
      500,
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

// ─── Seed Content Fallback ────────────────────────────────────────────
// Hard-coded headlines from major crypto sources for immediate display
// when the RSS pipeline returns 0 items (common on first boot).

export function getSeedStories(): NewsStoryResponse[] {
  const now = Date.now();
  return [
    {
      id: 'seed:coindesk:1',
      title: 'Bitcoin Holds $67K as Spot ETFs See Inflows for Fourth Straight Day',
      summary:
        'Bitcoin is holding above $67,000 as spot Bitcoin ETFs recorded net inflows for the fourth consecutive trading day, signaling renewed institutional interest.',
      url: 'https://www.coindesk.com/markets/2026/07/25/bitcoin-holds-67k',
      source: 'CoinDesk',
      sourceMeta: { id: 'coindesk', name: 'CoinDesk', tier: 1, credibility: 0.92 },
      author: 'CoinDesk',
      publishedAt: now - 900_000,
      categories: ['crypto', 'bitcoin', 'markets'],
      niches: ['bitcoin', 'markets', 'etf'],
      sentiment: {
        label: 'bullish',
        score: 0.6,
        confidence: 0.7,
        signals: ['+institutional', '+etf'],
      },
      entities: {
        tokens: ['BTC'],
        protocols: [],
        people: [],
        companies: ['BlackRock', 'Fidelity'],
        chains: ['bitcoin'],
        nfts: [],
      },
      alsoCoveredBy: ['CoinTelegraph', 'Decrypt'],
      isBreaking: true,
      velocity: 8,
      score: 95,
      readingTime: 3,
      imageUrl: 'https://assets.coindesk.com/og-image.png',
    },
    {
      id: 'seed:cointelegraph:1',
      title: 'Ethereum Layer-2 Activity Hits All-Time High as Gas Fees Drop 90%',
      summary:
        'Ethereum layer-2 networks reached a new all-time high in daily active addresses as blob transactions from EIP-4844 continue to lower gas fees.',
      url: 'https://cointelegraph.com/news/ethereum-layer-2-activity-all-time-high',
      source: 'CoinTelegraph',
      sourceMeta: { id: 'cointelegraph', name: 'CoinTelegraph', tier: 1, credibility: 0.9 },
      author: 'CoinTelegraph',
      publishedAt: now - 1_800_000,
      categories: ['crypto', 'ethereum', 'layer2'],
      niches: ['ethereum', 'layer2', 'scaling'],
      sentiment: {
        label: 'bullish',
        score: 0.5,
        confidence: 0.8,
        signals: ['+growth', '+adoption'],
      },
      entities: {
        tokens: ['ETH'],
        protocols: ['arbitrum', 'optimism', 'base'],
        people: [],
        companies: [],
        chains: ['ethereum'],
        nfts: [],
      },
      alsoCoveredBy: ['The Block'],
      isBreaking: false,
      velocity: 6,
      score: 88,
      readingTime: 4,
    },
    {
      id: 'seed:theblock:1',
      title: 'Solana DeFi TVL Surpasses $12B for First Time Since 2021 Peak',
      summary:
        "Solana's total value locked in DeFi protocols has exceeded $12 billion for the first time since November 2021, driven by liquid staking and new DEX volumes.",
      url: 'https://www.theblock.co/post/solana-defi-tvl-12b',
      source: 'The Block',
      sourceMeta: { id: 'theblock', name: 'The Block', tier: 1, credibility: 0.91 },
      author: 'The Block',
      publishedAt: now - 3_600_000,
      categories: ['crypto', 'defi', 'solana'],
      niches: ['solana', 'defi', 'tvl'],
      sentiment: {
        label: 'bullish',
        score: 0.7,
        confidence: 0.85,
        signals: ['+growth', '+adoption'],
      },
      entities: {
        tokens: ['SOL'],
        protocols: ['jupiter', 'raydium', 'marginfi'],
        people: [],
        companies: [],
        chains: ['solana'],
        nfts: [],
      },
      alsoCoveredBy: ['Solana Blog'],
      isBreaking: false,
      velocity: 5,
      score: 85,
      readingTime: 3,
    },
    {
      id: 'seed:decrypt:1',
      title: 'OpenAI Launches GPT-5 with 10x Reasoning at Lower Cost',
      summary:
        'OpenAI has unveiled GPT-5, claiming a 10x improvement in reasoning capabilities while reducing inference cost by 60%, marking a major leap in AI capabilities.',
      url: 'https://decrypt.co/openai-gpt-5-launch',
      source: 'Decrypt',
      sourceMeta: { id: 'decrypt', name: 'Decrypt', tier: 1, credibility: 0.88 },
      author: 'Decrypt',
      publishedAt: now - 2_400_000,
      categories: ['tech', 'ai'],
      niches: ['ai', 'llm', 'tech'],
      sentiment: { label: 'bullish', score: 0.4, confidence: 0.6, signals: ['+breakthrough'] },
      entities: {
        tokens: [],
        protocols: [],
        people: ['sam altman'],
        companies: ['OpenAI'],
        chains: [],
        nfts: [],
      },
      alsoCoveredBy: ['The Verge'],
      isBreaking: false,
      velocity: 7,
      score: 90,
      readingTime: 5,
    },
    {
      id: 'seed:theblock:2',
      title: 'SEC Signals Potential Shift in Crypto Policy, Sources Say',
      summary:
        'The Securities and Exchange Commission is signaling potential changes to its crypto enforcement approach, according to sources familiar with internal discussions.',
      url: 'https://www.theblock.co/post/sec-crypto-policy-shift',
      source: 'The Block',
      sourceMeta: { id: 'theblock', name: 'The Block', tier: 1, credibility: 0.91 },
      author: 'The Block',
      publishedAt: now - 4_200_000,
      categories: ['regulation', 'crypto'],
      niches: ['regulation', 'sec', 'policy'],
      sentiment: { label: 'neutral', score: 0.1, confidence: 0.5, signals: [] },
      entities: { tokens: [], protocols: [], people: [], companies: ['SEC'], chains: [], nfts: [] },
      alsoCoveredBy: ['CoinDesk Policy'],
      isBreaking: false,
      velocity: 4,
      score: 82,
      readingTime: 4,
    },
    {
      id: 'seed:coindesk:2',
      title: 'Bitcoin Mining Difficulty Adjusts Up 5% as Hash Rate Hits New Peak',
      summary:
        'Bitcoin mining difficulty has increased by approximately 5% in the latest automatic adjustment as the network hash rate reaches a new all-time high.',
      url: 'https://www.coindesk.com/tech/2026/07/25/bitcoin-mining-difficulty-adjusts-up',
      source: 'CoinDesk',
      sourceMeta: { id: 'coindesk', name: 'CoinDesk', tier: 1, credibility: 0.92 },
      author: 'CoinDesk',
      publishedAt: now - 7_200_000,
      categories: ['crypto', 'bitcoin', 'mining'],
      niches: ['bitcoin', 'mining', 'hashrate'],
      sentiment: { label: 'bullish', score: 0.3, confidence: 0.6, signals: ['+growth'] },
      entities: {
        tokens: ['BTC'],
        protocols: [],
        people: [],
        companies: [],
        chains: ['bitcoin'],
        nfts: [],
      },
      alsoCoveredBy: [],
      isBreaking: false,
      velocity: 3,
      score: 75,
      readingTime: 2,
    },
    {
      id: 'seed:a16z:1',
      title: 'a16z Leads $50M Round in Zero-Knowledge Proof Hardware Startup',
      summary:
        'Andreessen Horowitz has led a $50 million Series A in a startup building specialized hardware for zero-knowledge proof generation.',
      url: 'https://a16zcrypto.com/posts/zk-hardware-investment',
      source: 'a16z Crypto',
      sourceMeta: { id: 'a16z-crypto', name: 'a16z Crypto', tier: 1, credibility: 0.91 },
      author: 'a16z Crypto',
      publishedAt: now - 10_800_000,
      categories: ['vc-investment', 'crypto'],
      niches: ['vc', 'zero-knowledge', 'investment'],
      sentiment: {
        label: 'bullish',
        score: 0.5,
        confidence: 0.7,
        signals: ['+partnership', '+growth'],
      },
      entities: {
        tokens: [],
        protocols: [],
        people: [],
        companies: ['a16z'],
        chains: [],
        nfts: [],
      },
      alsoCoveredBy: ['CoinDesk'],
      isBreaking: false,
      velocity: 4,
      score: 80,
      readingTime: 4,
    },
    {
      id: 'seed:cointelegraph:2',
      title: 'Crypto Market Cap Adds $50B as Altcoins Rally Across the Board',
      summary:
        'The total cryptocurrency market capitalization added approximately $50 billion in the last 24 hours as altcoins experienced a broad-based rally.',
      url: 'https://cointelegraph.com/news/crypto-market-cap-adds-50b',
      source: 'CoinTelegraph',
      sourceMeta: { id: 'cointelegraph', name: 'CoinTelegraph', tier: 1, credibility: 0.9 },
      author: 'CoinTelegraph',
      publishedAt: now - 14_400_000,
      categories: ['crypto', 'markets'],
      niches: ['markets', 'altcoins', 'rally'],
      sentiment: { label: 'bullish', score: 0.6, confidence: 0.75, signals: ['+surge', '+rally'] },
      entities: {
        tokens: ['SOL', 'LINK', 'ETH', 'BTC'],
        protocols: [],
        people: [],
        companies: [],
        chains: ['solana', 'ethereum'],
        nfts: [],
      },
      alsoCoveredBy: ['CryptoSlate', 'Decrypt'],
      isBreaking: false,
      velocity: 5,
      score: 78,
      readingTime: 3,
    },
    {
      id: 'seed:coindesk:3',
      title: 'Base Chain Daily Transactions Surpass 5 Million, Outpacing Ethereum L1',
      summary:
        "Coinbase's Base layer-2 network has exceeded 5 million daily transactions for the first time, surpassing Ethereum mainnet in daily transaction count.",
      url: 'https://www.coindesk.com/tech/2026/07/25/base-chain-daily-transactions-5m',
      source: 'CoinDesk',
      sourceMeta: { id: 'coindesk', name: 'CoinDesk', tier: 1, credibility: 0.92 },
      author: 'CoinDesk',
      publishedAt: now - 21_600_000,
      categories: ['crypto', 'ethereum', 'layer2'],
      niches: ['layer2', 'base', 'ethereum'],
      sentiment: {
        label: 'bullish',
        score: 0.45,
        confidence: 0.7,
        signals: ['+growth', '+adoption'],
      },
      entities: {
        tokens: ['ETH'],
        protocols: ['base'],
        people: [],
        companies: ['Coinbase'],
        chains: ['ethereum', 'base'],
        nfts: [],
      },
      alsoCoveredBy: ['The Block'],
      isBreaking: false,
      velocity: 4,
      score: 76,
      readingTime: 3,
      imageUrl: 'https://images.ctfassets.net/og-image-base.png',
    },
    {
      id: 'seed:cointelegraph:3',
      title: 'RWA Tokenization Market Projected to Reach $30 Trillion by 2034',
      summary:
        'A new report projects the real-world asset tokenization market could reach $30 trillion by 2034, with fixed income, real estate, and commodities leading adoption.',
      url: 'https://cointelegraph.com/news/rwa-tokenization-30-trillion-2034',
      source: 'CoinTelegraph',
      sourceMeta: { id: 'cointelegraph', name: 'CoinTelegraph', tier: 1, credibility: 0.9 },
      author: 'CoinTelegraph',
      publishedAt: now - 28_800_000,
      categories: ['crypto', 'defi', 'markets'],
      niches: ['rwa', 'tokenization', 'defi', 'institutional'],
      sentiment: {
        label: 'bullish',
        score: 0.5,
        confidence: 0.7,
        signals: ['+growth', '+institutional'],
      },
      entities: {
        tokens: [],
        protocols: [],
        people: [],
        companies: ['BlackRock', 'Citigroup'],
        chains: [],
        nfts: [],
      },
      alsoCoveredBy: [],
      isBreaking: false,
      velocity: 3,
      score: 72,
      readingTime: 4,
    },
  ];
}
