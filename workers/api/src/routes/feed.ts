import { deduplicatePosts, enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import {
  BlueskyProvider,
  FarcasterProvider,
  type FeedProvider,
  LensProvider,
  MastodonProvider,
  NostrProvider,
  RedditProvider,
  ThreadsProvider,
} from '@degenfeed/feed-providers';
import { type UserAlgorithmPreferences, rank } from '@degenfeed/ranking';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse } from '../index';

const DEFAULT_PROTOCOLS: Protocol[] = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'threads',
  'rss',
];

const DEFAULT_TIMEOUT_MS = 6000;

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
    case 'rss':
      return new RedditProvider();
    default:
      throw new Error(`Unknown protocol: ${protocol}`);
  }
}

function buildRankingContext(
  now: number,
  prefs?: UserAlgorithmPreferences | null,
): {
  viewer: null;
  recentAuthors: Map<string, number>;
  sourceQuality: Map<string, number>;
  viewerNiches: Set<string>;
  followed: Set<string>;
  now: number;
  preferences?: UserAlgorithmPreferences | null;
} {
  return {
    viewer: null,
    recentAuthors: new Map(),
    sourceQuality: new Map(),
    viewerNiches: new Set(prefs?.preferredNiches ?? []),
    followed: new Set(),
    now,
    preferences: prefs ?? null,
  };
}

function filterByCategory(posts: UnifiedPost[], category: string): UnifiedPost[] {
  const target = category.toLowerCase();
  return posts.filter((p) => p.niches.map((n) => n.toLowerCase()).includes(target));
}

function extractTrendingTopics(posts: UnifiedPost[], now: number) {
  const counts = new Map<string, { count: number; score: number }>();
  const cutoff = now - 24 * 60 * 60 * 1000;
  for (const post of posts) {
    if (post.createdAt < cutoff) continue;
    for (const niche of post.niches) {
      const cur = counts.get(niche) ?? { count: 0, score: 0 };
      cur.count++;
      cur.score += 1;
      counts.set(niche, cur);
    }
    const text = `${post.text} ${post.author.displayName}`;
    const tickers = Array.from(text.matchAll(/\$([A-Z]{2,5})\b/g)).map((m) => m[1]);
    for (const t of tickers) {
      const cur = counts.get(`$${t}`) ?? { count: 0, score: 0 };
      cur.count++;
      cur.score += 2;
      counts.set(`$${t}`, cur);
    }
    const hashtags = Array.from(text.matchAll(/#[a-zA-Z0-9_]+/g)).map((m) => m[0]);
    for (const h of hashtags) {
      const cur = counts.get(h) ?? { count: 0, score: 0 };
      cur.count++;
      cur.score += 1.5;
      counts.set(h, cur);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 12)
    .map(([topic, v]) => ({ topic, count: v.count, score: v.score }));
}

export async function handleHomeFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'));
  const limit = Math.min(Number(params.get('limit')) || 25, 100);
  const category = params.get('category')?.toLowerCase() ?? '';
  const prefs: UserAlgorithmPreferences | null = null;

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
  const ctx = buildRankingContext(Date.now(), prefs);
  const ranked = rank(deduped, ctx).slice(0, Math.min(limit, 100));
  const trending = extractTrendingTopics(deduped, Date.now());

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
          note: 'All sources failed',
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
