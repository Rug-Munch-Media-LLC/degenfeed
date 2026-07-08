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
  scoreBreakdownV2,
  type UserAlgorithmPreferences,
} from '@degenfeed/ranking';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import { parseProtocols, rmiUrl } from '@degenfeed/utils';
import { type Env, jsonResponse } from '../index';

export const DEFAULT_PROTOCOLS: Protocol[] = [
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

export function getProvider(protocol: Protocol, env: Env): FeedProvider {
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
      return new ThreadsProvider();
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
  private readonly env: Env;
  private readonly rmi: RmiDataBusProvider;
  private readonly rss: RssProvider;

  constructor(env: Env) {
    this.env = env;
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
    const rmiUrlValue = rmiUrl(this.env);
    const rmiConfigured =
      rmiUrlValue && !rmiUrlValue.includes('127.0.0.1') && !rmiUrlValue.includes('localhost');
    if (rmiConfigured) {
      try {
        const result = await this.rmi.fetchFeed({
          ...opts,
          timeoutMs: Math.min(opts.timeoutMs ?? 2000, 2000),
        });
        if (result.posts.length > 0) return result;
      } catch {
        /* RMI unavailable — fall through */
      }
    }
    return this.rss.fetchFeed(opts);
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    if (!this.rmi.healthCheck) {
      return { healthy: false, latencyMs: 0, error: 'No health check implemented' };
    }
    return this.rmi.healthCheck(opts);
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
    preferredPlatforms: platforms ? (platforms.split(',').filter(Boolean) as Protocol[]) : [],
    recencyWeight: recencyWeight || 1,
    engagementWeight: engagementWeight || 1,
    diversityBoost: diversityBoost !== 'false',
  };
}

function filterByCategory(posts: UnifiedPost[], category: string): UnifiedPost[] {
  const target = category.toLowerCase();
  return posts.filter((p) => p.niches.map((n) => n.toLowerCase()).includes(target));
}

interface UserRankingContext {
  followed: Set<string>;
  mutedAuthors: Set<string>;
  mutedWords: Set<string>;
  preferences: {
    preferredNiches: string[];
    preferredPlatforms: Protocol[];
    recencyWeight: number;
    engagementWeight: number;
    diversityBoost: boolean;
    hideLowQuality?: boolean;
    hideLowQualityThreshold?: number;
    allowNonCrypto?: boolean;
  } | null;
}

async function loadUserRankingContext(request: Request, env: Env): Promise<UserRankingContext> {
  const empty: UserRankingContext = {
    followed: new Set(),
    mutedAuthors: new Set(),
    mutedWords: new Set(),
    preferences: null,
  };
  const cookie = request.headers.get('cookie');
  if (!cookie) return empty;
  // Parse session cookie
  const match = cookie
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('__Host-dfid='));
  if (!match) return empty;
  const value = match.slice('__Host-dfid='.length);
  // Verify session
  if (!env.AUTH_SECRET) return empty;
  const { verifySessionCookie } = await import('../session');
  const payload = await verifySessionCookie(value, env.AUTH_SECRET);
  if (!payload) return empty;
  // Load user-specific KV entries
  try {
    const [followsRaw, mutedAuthorsRaw, mutedWordsRaw, prefsRaw] = await Promise.all([
      env.CACHE?.get(`user:follows:${payload.address}`),
      env.CACHE?.get(`user:muted_authors:${payload.address}`),
      env.CACHE?.get(`user:muted_words:${payload.address}`),
      env.CACHE?.get(`user:prefs:${payload.address}`),
    ]);
    const followed = new Set<string>(followsRaw ? JSON.parse(followsRaw) : []);
    const mutedAuthors = new Set<string>(mutedAuthorsRaw ? JSON.parse(mutedAuthorsRaw) : []);
    const mutedWords = new Set<string>(mutedWordsRaw ? JSON.parse(mutedWordsRaw) : []);
    const preferences = prefsRaw ? JSON.parse(prefsRaw) : null;
    if (preferences && typeof preferences.hideLowQuality !== 'boolean') {
      preferences.hideLowQuality = false;
    }
    if (preferences && typeof preferences.allowNonCrypto !== 'boolean') {
      preferences.allowNonCrypto = false;
    }
    if (preferences && typeof preferences.hideLowQualityThreshold !== 'number') {
      preferences.hideLowQualityThreshold = 1.0;
    }
    return { followed, mutedAuthors, mutedWords, preferences };
  } catch {
    return empty;
  }
}

// ─── Circuit breaker ─────────────────────────────────────────────
// Per-provider KV-backed failure counter. After 3 consecutive
// failures in a 60s window, the provider is skipped on subsequent
// feed requests until a successful probe clears the breaker.

const CB_TTL = 60;
const CB_THRESHOLD = 3;

async function cbKey(protocol: string): Promise<string> {
  return `cb:${protocol}:${Math.floor(Date.now() / 60000)}`;
}

async function isCircuitOpen(env: Env, protocol: string): Promise<boolean> {
  if (!env.CACHE) return false;
  try {
    const key = await cbKey(protocol);
    const raw = await env.CACHE.get(key);
    if (!raw) return false;
    const { count } = JSON.parse(raw) as { count: number };
    return count >= CB_THRESHOLD;
  } catch {
    return false;
  }
}

async function incrCircuit(env: Env, protocol: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = await cbKey(protocol);
    const raw = await env.CACHE.get(key);
    const count = raw ? (JSON.parse(raw) as { count: number }).count + 1 : 1;
    await env.CACHE.put(key, JSON.stringify({ count }), { expirationTtl: CB_TTL });
  } catch {
    /* ignore */
  }
}

async function resetCircuit(env: Env, protocol: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = await cbKey(protocol);
    await env.CACHE.delete(key);
  } catch {
    /* ignore */
  }
}

export async function handleHomeFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'), DEFAULT_PROTOCOLS);
  const limit = Math.min(Number(params.get('limit')) || 25, 100);
  const category = params.get('category')?.toLowerCase() ?? '';
  const prefs = parsePrefsFromQuery(params);
  const diverse = params.get('diverse') !== 'false';
  const queryAllowNonCrypto = params.get('allowNonCrypto') === 'true';

  const allPosts: UnifiedPost[] = [];
  const errors: string[] = [];
  const perProtocol: Record<string, number> = {};
  const notices: string[] = [];

  const results = await Promise.allSettled(
    requestedProtocols.map(async (protocol) => {
      // Circuit breaker: skip providers that have failed 3+ times in the
      // last 60s window. KV-backed so it survives worker restarts.
      if (await isCircuitOpen(env, protocol)) {
        return { protocol, posts: [] as UnifiedPost[], skipped: true };
      }
      try {
        const provider = getProvider(protocol, env);
        const result = await provider.fetchFeed({
          timeoutMs: DEFAULT_TIMEOUT_MS,
          concurrency: 4,
        });
        const filtered = result.posts.filter((p) => !isSpamPost(p)).map(enrichPostNiches);
        if (result.notice) notices.push(result.notice);
        // Success → reset the circuit breaker count.
        void resetCircuit(env, protocol);
        return { protocol, posts: filtered };
      } catch (err) {
        // Failure → bump the circuit breaker count.
        void incrCircuit(env, protocol);
        const message = err instanceof Error ? err.message : 'unknown';
        return { protocol, posts: [] as UnifiedPost[], error: message };
      }
    }),
  );

  for (const [index, result] of results.entries()) {
    const protocol = requestedProtocols[index];
    if (!protocol) continue;
    if (result.status === 'fulfilled') {
      if ('skipped' in result.value && result.value.skipped) {
        errors.push(`${protocol}: circuit breaker open — skipping`);
        perProtocol[protocol] = 0;
      } else {
        perProtocol[protocol] = result.value.posts.length;
        allPosts.push(...result.value.posts);
      }
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

  // Farcaster fallback: load from KV cache when the hub is unreachable
  // from the Cloudflare edge. Cache is populated by Talos cron.
  if (perProtocol['farcaster'] === 0 && env.CACHE) {
    try {
      const cached = await env.CACHE.get('farcaster:trending:v4');
      if (cached) {
        const parts = cached.split('|').filter(Boolean);
        for (const part of parts) {
          try {
            const hubData = JSON.parse(part);
            for (const msg of hubData.messages ?? []) {
              const fid = msg.signer ? parseInt((msg.signer as string).slice(2, 6), 16) % 10000 : 3; // approximate — hub messages include signer info
              const ts = ((msg.data?.timestamp ?? 0) + 1609459200) * 1000;
              const rawText = msg.data?.castAddBody?.text ?? '';
              const text = rawText.length > 12 ? rawText : `Farcaster cast: ${rawText || "view on warpcast"}`;
              if (!text) continue;
              const post = {
                id: `farcaster:${msg.hash || 'unknown'}`,
                protocol: 'farcaster' as Protocol,
                author: {
                  id: `farcaster:${fid}`,
                  primary: { protocol: 'farcaster' as Protocol, id: String(fid) },
                  handles: {
                    nostr: null,
                    farcaster: `fid:${fid}`,
                    lens: null,
                    bluesky: null,
                    threads: null,
                    rss: null,
                    mastodon: null,
                  },
                  displayName: `FID ${fid}`,
                  bio: '',
                  avatarUrl: '',
                  verified: [],
                  followerCount: 0,
                  followingCount: 0,
                  links: [],
                  keys: {},
                },
                text,
                embeds: [],
                createdAt: isNaN(ts) ? Date.now() : ts,
                metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
                engagement: {
                  viewerLiked: false,
                  viewerReposted: false,
                  viewerBookmarked: false,
                  raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
                },
                raw: msg,
                niches: ['crypto', 'farcaster', 'tech'],
                score: {
                  total: 2,
                  recency: 0.5,
                  engagement: 0.5,
                  relevance: 1,
                  quality: 0.5,
                  diversity: 0,
                  source: 0.5,
                  velocity: 1,
                  reasons: ['cached'],
                },
              };
              allPosts.push(post as unknown as UnifiedPost);
            }
          } catch {
            /* skip malformed cache entries */
          }
        }
        perProtocol['farcaster'] = cached.split('|').filter(Boolean).length * 2;
      }
    } catch {
      /* KV read failed */
    }
  }

  // Load per-user ranking context (followed, muted, preferences) from KV
  // via the session cookie. Unauthenticated users get an empty context.
  const userCtx = await loadUserRankingContext(request, env);
  // Resolve allowNonCrypto from query param OR stored preference early so the
  // relevance filter below can use it.
  const allowNonCrypto = queryAllowNonCrypto || userCtx.preferences?.allowNonCrypto === true;
  // Filter out muted authors and posts containing muted words
  if (userCtx.mutedAuthors.size > 0 || userCtx.mutedWords.size > 0) {
    deduped = deduped.filter((p) => {
      if (p.author.id && userCtx.mutedAuthors.has(p.author.id)) return false;
      if (userCtx.mutedWords.size > 0) {
        const text = `${p.text} ${p.html ?? ''}`.toLowerCase();
        for (const word of userCtx.mutedWords) {
          if (text.includes(word.toLowerCase())) return false;
        }
      }
      return true;
    });
  }
  // Skip the crypto-gating relevance filter when the user opts into non-crypto
  // content. The spam filter still applies so we don't drown in junk.
  const relevant = allowNonCrypto ? deduped : deduped.filter(isRelevantPost);
  // Merge per-user preferred niches/platforms into the query params
  const mergedPrefs: UserAlgorithmPreferences = prefs ?? {
    preferredNiches: [],
    preferredPlatforms: [],
    recencyWeight: 1,
    engagementWeight: 1,
    diversityBoost: true,
  };
  if (userCtx.preferences) {
    for (const n of userCtx.preferences.preferredNiches) {
      if (!mergedPrefs.preferredNiches.includes(n)) {
        mergedPrefs.preferredNiches = [...mergedPrefs.preferredNiches, n];
      }
    }
    for (const p of userCtx.preferences.preferredPlatforms) {
      if (!mergedPrefs.preferredPlatforms.includes(p)) {
        mergedPrefs.preferredPlatforms = [...mergedPrefs.preferredPlatforms, p];
      }
    }
    if (userCtx.preferences.recencyWeight)
      mergedPrefs.recencyWeight = userCtx.preferences.recencyWeight;
    if (userCtx.preferences.engagementWeight)
      mergedPrefs.engagementWeight = userCtx.preferences.engagementWeight;
    if (userCtx.preferences.diversityBoost === false) mergedPrefs.diversityBoost = false;
  }
  // Resolve hide-low-quality controls. Query params override stored prefs
  // for the duration of the request; the persisted preference still wins
  // on subsequent fetches.
  const queryHideLowQuality = params.get('hideLowQuality') === 'true';
  const queryThreshold = Number(params.get('hideLowQualityThreshold'));
  const hideLowQuality = queryHideLowQuality || userCtx.preferences?.hideLowQuality === true;
  const hideLowQualityThreshold =
    Number.isFinite(queryThreshold) && queryThreshold > 0
      ? queryThreshold
      : (userCtx.preferences?.hideLowQualityThreshold ?? 1.0);
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
    if (p.author.id && p.author.id.includes('social.degenfeed.xyz')) {
      sourceQuality.set(key, (sourceQuality.get(key) ?? 0.5) + 1.5);
    }
  }

  // Load previous engagement snapshots from KV for velocity tracking.
  // Each key is eng:<postId> with TTL 300s, storing {likes, reposts, replies, at}.
  const previousEngagement = new Map<
    string,
    { likes: number; reposts: number; replies: number; at: number }
  >();
  if (env.CACHE) {
    try {
      const keys = relevant.slice(0, 200).map((p) => `eng:${p.id}`);
      const results = await Promise.allSettled(keys.map((k) => env.CACHE!.get(k)));
      for (let i = 0; i < results.length; i++) {
        const r = results[i] as PromiseFulfilledResult<string | null> | PromiseRejectedResult;
        const postId = relevant[i]?.id;
        if (r.status === 'fulfilled' && r.value && postId) {
          try {
            const snap = JSON.parse(r.value) as {
              likes: number;
              reposts: number;
              replies: number;
              at: number;
            };
            previousEngagement.set(postId, snap);
          } catch {
            /* skip */
          }
        }
      }
    } catch {
      /* skip velocity — non-critical */
    }
  }

  const ctx = buildRankingContext(
    Date.now(),
    mergedPrefs,
    recentAuthors,
    userCtx.followed,
    sourceQuality,
  );
  // Inject previous engagement for velocity scoring.
  (ctx as Record<string, unknown>).previousEngagement = previousEngagement;

  // Compute score breakdowns for transparency / hover signals.
  const scoredRelevant = relevant.map((p) => ({ post: p, breakdown: scoreBreakdownV2(p, ctx) }));

  // Store current engagement snapshots for next velocity calculation.
  // Fire-and-forget — non-critical.
  void (async () => {
    if (!env.CACHE) return;
    const now = Date.now();
    const puts = relevant.slice(0, 100).map((p) =>
      env
        .CACHE!.put(
          `eng:${p.id}`,
          JSON.stringify({
            likes: p.metrics.likes,
            reposts: p.metrics.reposts,
            replies: p.metrics.replies,
            at: now,
          }),
          { expirationTtl: 300 },
        )
        .catch(() => {}),
    );
    await Promise.allSettled(puts);
  })();
  // Optionally filter low-quality posts at the user's preferred threshold.
  // Threshold 0 means "only drop truly negative scores"; higher is stricter.
  const filteredScored = hideLowQuality
    ? scoredRelevant.filter((s) => s.breakdown.total >= hideLowQualityThreshold)
    : scoredRelevant;
  // rankDiverse: greedy per-author cap ensures a balanced feed
  // (otherwise one noisy author can dominate).
  const rankedPosts = (
    diverse
      ? rankDiverse(
          filteredScored.map((s) => s.post),
          ctx,
          { maxPerAuthor: 2 },
        )
      : filteredScored.map((s) => s.post)
  ).slice(0, Math.min(limit, 100));
  // Attach score breakdowns by id lookup
  const scoreById = new Map(filteredScored.map((s) => [s.post.id, s.breakdown]));
  const ranked = rankedPosts.map((p) => {
    const breakdown = scoreById.get(p.id);
    if (!breakdown) return p;
    return {
      ...p,
      score: {
        total: breakdown.total,
        recency: breakdown.recency,
        engagement: breakdown.engagement,
        relevance: breakdown.relevance,
        quality: breakdown.quality,
        diversity: breakdown.diversity,
        source: breakdown.source,
        velocity: breakdown.velocity,
        reasons: breakdown.reasons,
      },
    };
  });
  const trending = computeTrendingTopics(relevant, Date.now());
  // Merge trending hashtags from our Mastodon instance
  try {
    const mastoTrends = await fetch('https://social.degenfeed.xyz/api/v1/trends/tags?limit=8', {
      headers: { 'user-agent': 'DegenFeed/0.1' },
    });
    if (mastoTrends.ok) {
      const tags = (await mastoTrends.json()) as Array<{
        name: string;
        history: Array<{ accounts: string }>;
      }>;
      for (const tag of tags) {
        const existing = trending.find((t) => t.topic === tag.name);
        if (existing) existing.score += tag.history?.length || 0;
        else trending.push({ topic: tag.name, count: tag.history?.length || 1, score: 3 });
      }
    }
  } catch {
    /* trending unavailable */
  }
  // Top-of-hour: highest-engagement post from the last 60 minutes.
  const now = Date.now();
  const recentPosts = scoredRelevant.filter((s) => now - s.post.createdAt < 3600000);
  const topOfHour =
    recentPosts.length > 0
      ? recentPosts.reduce((best, cur) =>
          cur.breakdown.engagement > best.breakdown.engagement ? cur : best,
        ).post.id
      : null;

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
          note:
            relevant.length === 0 ? 'No relevant posts found' : 'All sources failed or filtered',
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
      topOfHour,
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

export async function handleRedditFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const subreddit = params.get('subreddit');
  const limit = Math.min(Number(params.get('limit')) || 25, 100);
  const cacheKey = `reddit:v1:${subreddit || 'all'}:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* ignore */
  }

  const { RedditProvider } = (await import('@degenfeed/feed-providers')) as unknown as {
    RedditProvider: new (options?: {
      subreddits?: string[];
    }) => {
      fetchFeed: (opts?: {
        timeoutMs?: number;
      }) => Promise<{ posts: import('@degenfeed/types').UnifiedPost[]; notice?: string }>;
    };
  };
  const provider = subreddit
    ? new RedditProvider({ subreddits: [subreddit] })
    : new RedditProvider();
  const result = await provider.fetchFeed({ timeoutMs: 5000 });
  const posts = result.posts.slice(0, limit);
  const response = {
    data: posts,
    meta: {
      total: posts.length,
      limit,
      subreddit: subreddit || 'all',
      notice: result.notice,
      fetchedAt: Date.now(),
    },
  };
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 180 });
  } catch {
    /* ignore */
  }
  return jsonResponse(response);
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
  const cacheKey = 'health:v2:default';
  const cached = await readCachedHealth(env, cacheKey);
  if (cached) return jsonResponse(cached);

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

  const body = { health, checkedAt: Date.now() };
  await writeCachedHealth(env, cacheKey, body);
  return jsonResponse(body);
}

async function readCachedHealth(
  env: Env,
  key: string,
): Promise<{ health: Record<string, unknown>; checkedAt: number } | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { health: Record<string, unknown>; checkedAt: number };
    // 30s stale-while-revalidate: return cached data if it's within the window.
    if (Date.now() - parsed.checkedAt < 30_000) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

async function writeCachedHealth(
  env: Env,
  key: string,
  body: { health: Record<string, unknown>; checkedAt: number },
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(body), { expirationTtl: 60 });
  } catch {
    /* ignore */
  }
}
