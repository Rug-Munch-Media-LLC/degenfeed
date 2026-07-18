/**
 * RmiDataBusProvider — pulls institutional-grade crypto news + intel
 * directly from the rmi-backend's /api/v1/news/* routes. This is the
 * bridge between RMI's 319+ source DataBus aggregator and DegenFeed.
 *
 * Wire in: set RMI_BACKEND_URL in the worker env (default
 * http://127.0.0.1:8000 on Talos, https://api.rugmunch.io in prod).
 *
 * The provider is a normal FeedProvider — the home feed route already
 * includes 'rss' (via RssProvider) and this provider can be added
 * alongside it for the dedicated RMI signal.
 */
import { detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  fetchJson,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

export const DEFAULT_RMI_BACKEND_URL = 'http://127.0.0.1:8000';

export interface RmiArticle {
  id?: string;
  title?: string;
  url?: string;
  description?: string | null;
  source?: string;
  published_at?: string | null;
  image_url?: string | null;
  category?: string | null;
  sentiment?: string | null;
  kind?: string | null;
  tier?: string | null;
  reddit_score?: number | null;
  reddit_comments?: number | null;
  risk_score?: number | null;
  token_address?: string | null;
  chain?: string | null;
  comment_count?: number | null;
}

export interface RmiFeedResponse {
  status?: string;
  articles?: RmiArticle[];
  total?: number;
  sources?: string[];
  source_count?: number;
  sentiment_summary?: Record<string, number>;
  tiers?: string[];
  fetched_at?: string;
}

interface RmiHeadlinesResponse {
  headlines?: Array<{
    title?: string;
    url?: string;
    source?: string;
    published_at?: string;
    category?: string;
    sentiment?: string;
    kind?: string;
  }>;
  count?: number;
}

function sentimentToScore(s: string | null | undefined): number {
  if (!s) return 0;
  const t = s.toLowerCase();
  if (t.includes('bullish')) return 1;
  if (t.includes('bearish')) return -1;
  return 0;
}

function authorFromSource(source: string): UnifiedIdentity {
  const id = `rmi:news:${source.replace(/\s+/g, '-').toLowerCase()}`;
  return {
    id,
    primary: { protocol: 'rss', id },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: source,
    bio: 'RMI DataBus',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: { rssUrl: source },
  };
}

function articleToUnifiedPost(a: RmiArticle, _backendUrl: string): UnifiedPost | null {
  const title = (a.title ?? '').trim();
  const url = (a.url ?? '').trim();
  if (!title || !url) return null;
  const description = (a.description ?? '').trim();
  const source = a.source?.trim() || 'RMI DataBus';
  const id = a.id || `rmi:${hashSlug(url)}`;

  // Combine title + description for niche detection
  const text = `${title}\n\n${description}`.slice(0, 1500);
  const niches = new Set<string>(detectNiches(text));
  if (a.category) niches.add(String(a.category).toLowerCase());
  if (a.chain) niches.add(String(a.chain).toLowerCase());

  const embeds: {
    kind: 'image' | 'link' | 'video';
    url: string;
    meta?: Record<string, unknown>;
  }[] = [];
  if (a.image_url) embeds.push({ kind: 'image', url: a.image_url });
  embeds.push({ kind: 'link', url, meta: { title, description } });

  // Synthesize engagement from RMI's risk_score / reddit metrics
  const likes = Math.max(0, Math.floor((a.risk_score ?? 0) * 10) + (a.reddit_score ?? 0));
  const reposts = Math.max(0, Math.floor((a.reddit_score ?? 0) / 5));
  const replies = Math.max(0, a.reddit_comments ?? a.comment_count ?? 0);
  const quotes = 0;

  const publishedAt = a.published_at ? new Date(a.published_at).getTime() : Date.now();
  const createdAt = Number.isNaN(publishedAt) ? Date.now() : publishedAt;

  // Annotate raw with sentiment for downstream consumers
  const raw: Record<string, unknown> = {
    article: a,
    sourceName: source,
    sentiment: a.sentiment,
    sentimentScore: sentimentToScore(a.sentiment),
    kind: a.kind,
    tier: a.tier,
    chain: a.chain,
    tokenAddress: a.token_address,
    riskScore: a.risk_score,
  };

  return {
    id,
    protocol: 'rss',
    author: authorFromSource(source),
    text,
    html: description,
    embeds,
    createdAt,
    metrics: { likes, reposts, replies, quotes },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes, reposts, replies, quotes },
    },
    raw,
    niches: [...niches],
  };
}

function hashSlug(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export interface RmiDataBusProviderOptions {
  backendUrl?: string;
  /** Optional API key if the rmi-backend is gated */
  apiKey?: string;
  /** Override the default /api/v1/news/feed path */
  feedPath?: string;
  /** Override the default /api/v1/news/headlines path */
  headlinesPath?: string;
}

export class RmiDataBusProvider implements FeedProvider {
  readonly protocol: Protocol = 'rss';
  private readonly backendUrl: string;
  private readonly apiKey?: string;
  private readonly feedPath: string;
  private readonly headlinesPath: string;

  constructor(options: RmiDataBusProviderOptions = {}) {
    this.backendUrl = options.backendUrl || DEFAULT_RMI_BACKEND_URL;
    this.apiKey = options.apiKey;
    this.feedPath = options.feedPath || '/api/v1/news/feed';
    this.headlinesPath = options.headlinesPath || '/api/v1/news/headlines';
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const headers: Record<string, string> = {};
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    try {
      const url = buildUrl(this.backendUrl, this.feedPath, {
        limit: String(Math.min(opts.signal ? 100 : 200, 200)),
        include_internal: 'true',
        include_reddit: 'true',
        include_rss: 'true',
      });
      const data = await withTimeout(
        fetchJson<RmiFeedResponse>(url, { headers, signal: opts.signal }),
        timeoutMs,
        'rmi:feed',
      );
      const articles = data.articles ?? [];
      if (articles.length === 0) {
        return { posts: [], notice: 'RMI DataBus returned no articles' };
      }
      const posts: UnifiedPost[] = [];
      const dedup = new Set<string>();
      for (const a of articles) {
        const post = articleToUnifiedPost(a, this.backendUrl);
        if (!post) continue;
        if (dedup.has(post.id)) continue;
        dedup.add(post.id);
        posts.push(post);
      }
      return { posts };
    } catch (err) {
      return {
        posts: [],
        notice: err instanceof Error ? err.message : 'RMI DataBus unavailable',
      };
    }
  }

  /**
   * Fetch the top headlines with category/sentiment signals — used
   * by the newsletter / pre-rendered home hero.
   */
  async fetchHeadlines(count = 10, category?: string): Promise<RmiHeadlinesResponse> {
    const url = buildUrl(this.backendUrl, this.headlinesPath, {
      count: String(count),
      ...(category ? { category } : {}),
    });
    const headers: Record<string, string> = {};
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    return withTimeout(
      fetchJson<RmiHeadlinesResponse>(url, { headers }),
      DEFAULT_TIMEOUT_MS,
      'rmi:headlines',
    );
  }

  async fetchParallel(
    categories: string[],
    opts: FetchOptions = {},
  ): Promise<(RmiFeedResponse | null)[]> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const headers: Record<string, string> = {};
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    return withConcurrencyLimit(categories, Math.min(categories.length, 4), async (category) => {
      try {
        const url = buildUrl(this.backendUrl, this.feedPath, {
          limit: '50',
          category,
        });
        return await withTimeout(
          fetchJson<RmiFeedResponse>(url, { headers }),
          timeoutMs,
          `rmi:cat:${category}`,
        );
      } catch {
        return null;
      }
    });
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = Date.now();
    try {
      await withTimeout(
        fetchJson(buildUrl(this.backendUrl, '/api/v1/news/sources'), {
          headers: this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {},
        }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'rmi:health',
      );
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
