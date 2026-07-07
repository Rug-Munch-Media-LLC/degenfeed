import {
  deduplicatePosts,
  enrichPostNiches,
  isRelevantPost,
  isSpamPost,
} from '@degenfeed/feed-core';
import {
  BlueskyProvider,
  FarcasterProvider,
  type FeedProvider,
  type FeedResult,
  type FetchOptions,
  type HealthResult,
  LensProvider,
  MastodonProvider,
  NostrProvider,
  RedditProvider,
  RmiDataBusProvider,
  RssProvider,
  ThreadsProvider,
} from '@degenfeed/feed-providers';
import {
  computeTrendingTopics,
  rankDiverse,
  type UserAlgorithmPreferences,
} from '@degenfeed/ranking';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse } from '../index';

const DEFAULT_PROTOCOLS: Protocol[] = [
  'rss',
  'reddit',
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'threads',
];

const DEFAULT_TIMEOUT_MS = 6000;

function rmiUrl(env: Env): string {
  return (env as Env & { RMI_BACKEND_URL?: string }).RMI_BACKEND_URL || 'http://127.0.0.1:8000';
}

function parseProtocols(raw: string | null): Protocol[] {
  if (!raw) return DEFAULT_PROTOCOLS;
  const parts = raw.split(',').map((p) => p.trim()) as Protocol[];
  const valid = new Set<Protocol>(DEFAULT_PROTOCOLS);
  return parts.filter((p): p is Protocol => valid.has(p));
}

function getProvider(protocol: Protocol, env: Env): FeedProvider {
  switch (protocol) {
    case 'nostr':
      return new NostrProvider({
        relays: (env.RELAY_URLS ?? '').split(',').filter(Boolean),
      });
    case 'farcaster':
      return new FarcasterProvider({ hubUrl: env.FARCASTER_HUB_URL });
    case 'lens':
      return new LensProvider({ apiUrl: env.LENS_API_URL });
    case 'bluesky':
      return new BlueskyProvider({ baseUrl: env.BSKY_PUBLIC_URL });
    case 'mastodon':
      return new MastodonProvider({ instanceUrl: env.GTS_INSTANCE_URL });
    case 'threads':
      return new ThreadsProvider({ pdsUrl: env.THREADS_PDS_URL });
    case 'reddit':
      return new RedditProvider();
    case 'rss':
      return new RssWithFallbackProvider(env);
    default:
      throw new Error(`Unknown protocol: ${protocol}`);
  }
}

// Wrapper that tries RMI first, falls back to public RSS.
// This is needed because RMI is only reachable from Talos internal
// network, not from the Cloudflare edge.
class RssWithFallbackProvider implements FeedProvider {
  readonly protocol: Protocol = 'rss';
  private readonly rmi: RmiDataBusProvider;
  private readonly rss: RssProvider;

  constructor(env: Env) {
    this.rmi = new RmiDataBusProvider({ backendUrl: rmiUrl(env) });
    // Use a small curated set for edge reliability — the full 40+ feed
    // list is too slow from Cloudflare Workers.
    this.rss = new RssProvider({
      feeds: [
        'https://cointelegraph.com/rss',
        'https://decrypt.co/feed',
        'https://bitcoinmagazine.com/.rss/full/',
        'https://blog.ethereum.org/feed.xml',
        'https://blog.chain.link/feed/',
        'https://bankless.substack.com/feed',
        'https://weekinethereumnews.com/feed',
      ],
    });
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      const result = await this.rmi.fetchFeed(opts);
      if (result.posts.length > 0) return result;
    } catch {
      /* RMI unavailable — fall through */
    }
    return this.rss.fetchFeed(opts);
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    try {
      return await this.rmi.healthCheck!(opts);
    } catch {
      return this.rss.healthCheck!(opts);
    }
  }
}

function buildRankingContext(
  now: number,
  prefs?: UserAlgorithmPreferences | null,
  recentAuthors?: Map<string, number>,
  followed?: Set<string>,
  sourceQuality?: Map<string, number>,
): {
  viewer: UnifiedIdentity | null;
  recentAuthors: Map<string, number>;
  sourceQuality: Map<string, number>;
  viewerNiches: Set<string>;
  followed: Set<string>;
  now: number;
  preferences?: UserAlgorithmPreferences | null;
} {
  return {
    viewer: null,
    recentAuthors: recentAuthors ?? new Map(),
    sourceQuality: sourceQuality ?? new Map(),
    viewerNiches: new Set(prefs?.preferredNiches ?? []),
    followed: followed ?? new Set(prefs?.followed ?? []),
    now,
    preferences: prefs ?? null,
  };
}

function parsePrefsFromQuery(params: URLSearchParams): UserAlgorithmPreferences | null {
  const niches = params.get('niches');
  const platforms = params.get('platforms');
  const recencyWeight = Number(params.get('recencyWeight'));
  const engagementWeight = Number(params.get('engagementWeight'));
  const diversityBoost = params.get('diversityBoost');
  if (!niches && !platforms && !recencyWeight && !engagementWeight) return null;
  return {
    preferredNiches: niches ? niches.split(',').filter(Boolean) : [],
    preferredPlatforms: platforms
      ? (platforms.split(',').filter(Boolean) as Protocol[])
      : [],
    recencyWeight: recencyWeight || 1,
    engagementWeight: engagementWeight || 1,
    diversityBoost: diversityBoost !== 'false',
  };
}

function filterByCategory(posts: UnifiedPost[], category: string): UnifiedPost[] {
  const target = category.toLowerCase();
  return posts.filter((p) => p.niches.map((n) => n.toLowerCase()).includes(target));
}

export async function handleHomeFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'));
  const limit = Math.min(Number(params.get('limit')) || 25, 100);
  const category = params.get('category')?.toLowerCase() ?? '';
  const prefs = parsePrefsFromQuery(params);
  const diverse = params.get('diverse') !== 'false';

  const allPosts: UnifiedPost[] = [];
  const errors: string[] = [];
  const perProtocol: Record<string, number> = {};
  const notices: string[] = [];

  const results = await Promise.allSettled(
    requestedProtocols.map(async (protocol) => {
      const provider = getProvider(protocol, env);
      const result = await provider.fetchFeed({
        timeoutMs: DEFAULT_TIMEOUT_MS,
        concurrency: 4,
      });
      const filtered = result.posts.filter((p) => !isSpamPost(p)).map(enrichPostNiches);
      if (result.notice) notices.push(result.notice);
      return { protocol, posts: filtered };
    }),
  );

  for (const [index, result] of results.entries()) {
    const protocol = requestedProtocols[index];
    if (!protocol) continue;
    if (result.status === 'fulfilled') {
      perProtocol[protocol] = result.value.posts.length;
      allPosts.push(...result.value.posts);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : 'unknown';
      errors.push(`${protocol}: ${message}`);
      perProtocol[protocol] = 0;
    }
  }

  let deduped = deduplicatePosts(allPosts);
  if (category) {
    deduped = filterByCategory(deduped, category);
  }
  const relevant = deduped.filter(isRelevantPost);
  // Populate recentAuthors for the diversity bonus: count how many times
  // each author appears. Authors that appear more than once get penalized
  // so one noisy account doesn't dominate the feed.
  const recentAuthors = new Map<string, number>();
  const sourceQuality = new Map<string, number>();
  for (const p of relevant) {
    const key = p.author.id;
    recentAuthors.set(key, (recentAuthors.get(key) ?? 0) + 1);
    if (p.author.followerCount > 0) {
      sourceQuality.set(key, Math.min(1.5, p.author.followerCount / 10000));
    }
  }
  const ctx = buildRankingContext(Date.now(), prefs, recentAuthors, undefined, sourceQuality);
  // rankDiverse: greedy per-author cap ensures a balanced feed
  // (otherwise one noisy author can dominate).
  const ranked = (diverse ? rankDiverse(relevant, ctx, { maxPerAuthor: 2 }) : [...relevant]).slice(
    0,
    Math.min(limit, 100),
  );
  const trending = computeTrendingTopics(relevant, Date.now());

  if (ranked.length === 0 && errors.length > 0) {
    return jsonResponse(
      {
        data: [],
        meta: {
          total: 0,
          limit,
          perProtocol,
          errors,
          notices,
          fetchedAt: Date.now(),
          note: relevant.length === 0 ? 'No relevant posts found' : 'All sources failed',
        },
      },
      200,
    );
  }

  return jsonResponse({
    data: ranked,
    meta: {
      total: ranked.length,
      limit,
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      trending,
      fetchedAt: Date.now(),
    },
  });
}

export async function handleTrendingFeed(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set('protocols', DEFAULT_PROTOCOLS.join(','));
  return handleHomeFeed(new Request(url.toString()), env);
}

export async function handleCategoryFeed(
  request: Request,
  env: Env,
  category: string,
): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set('category', category);
  return handleHomeFeed(new Request(url.toString()), env);
}

export async function handleProviderFeed(
  request: Request,
  env: Env,
  provider: string,
): Promise<Response> {
  const valid = new Set<Protocol>(DEFAULT_PROTOCOLS);
  if (!valid.has(provider as Protocol)) {
    return jsonResponse({ error: 'Unknown provider' }, 400);
  }
  const protocol = provider as Protocol;
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 25, 100);

  try {
    const feedProvider = getProvider(protocol, env);
    const result = await feedProvider.fetchFeed({
      timeoutMs: DEFAULT_TIMEOUT_MS,
      concurrency: 4,
    });
    const posts = result.posts
      .filter((p) => !isSpamPost(p))
      .map(enrichPostNiches)
      .slice(0, limit);
    return jsonResponse({
      data: posts,
      meta: {
        total: posts.length,
        limit,
        protocol,
        notice: result.notice,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider fetch failed';
    return jsonResponse({ error: message }, 502);
  }
}

export async function handleFeedHealth(_request: Request, env: Env): Promise<Response> {
  const results = await Promise.allSettled(
    DEFAULT_PROTOCOLS.map(async (protocol) => {
      const provider = getProvider(protocol, env);
      if (!provider.healthCheck) {
        return { protocol, healthy: false, latencyMs: 0, error: 'No health check implemented' };
      }
      const health = await provider.healthCheck({ timeoutMs: 3000 });
      return { protocol, ...health };
    }),
  );

  const health: Record<string, { healthy: boolean; latencyMs: number; error?: string }> = {};
  for (const [index, result] of results.entries()) {
    const protocol = DEFAULT_PROTOCOLS[index];
    if (!protocol) continue;
    if (result.status === 'fulfilled') {
      health[protocol] = result.value;
    } else {
      health[protocol] = {
        healthy: false,
        latencyMs: 0,
        error: result.reason instanceof Error ? result.reason.message : 'unknown',
      };
    }
  }

  return jsonResponse({ health, checkedAt: Date.now() });
}
