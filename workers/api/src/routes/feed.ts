import {
  deduplicatePosts,
  detectContentType,
  enrichPostNiches,
  isEnglishPost,
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
  LemmyProvider,
  LensProvider,
  MastodonProvider,
  NostrProvider,
  PonderProvider,
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
  'lemmy',
  'ponder',
];

const DEFAULT_TIMEOUT_MS = 6000;
const CACHE_PROVIDER_TTL = 120;

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
    case 'lemmy':
      return new LemmyProvider();
    case 'threads':
      return new ThreadsProvider();
    case 'reddit':
      return new RedditProvider({ redlibUrl: env.REDLIB_URL });
    case 'ponder':
      return new PonderProvider();
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
      } catch (err) {
        console.warn(
          '[feed] RMI unavailable — falling back to RSS:',
          err instanceof Error ? err.message : err,
        );
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
  } catch (err) {
    console.warn('[feed] loadUserRankingContext failed:', err instanceof Error ? err.message : err);
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
  } catch (err) {
    console.warn('[feed] isCircuitOpen failed:', err instanceof Error ? err.message : err);
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
  } catch (err) {
    // Non-critical cache write — log and continue
    console.warn('[feed] incrCircuit KV write failed:', err instanceof Error ? err.message : err);
  }
}

async function resetCircuit(env: Env, protocol: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = await cbKey(protocol);
    await env.CACHE.delete(key);
  } catch (err) {
    // Non-critical cache write — log and continue
    console.warn('[feed] resetCircuit KV delete failed:', err instanceof Error ? err.message : err);
  }
}

// ─── Per-provider KV cache (stale-while-revalidate) ────────────────
// Caches provider results in KV with CACHE_PROVIDER_TTL expiry.
// On cache hit the response is returned immediately and a background
// refresh is triggered so subsequent requests see fresh data.

function providerCacheKey(protocol: string, limit: number): string {
  return `feed:provider:${protocol}:l=${limit}`;
}

async function readProviderCache(
  env: Env,
  protocol: string,
  limit: number,
): Promise<UnifiedPost[] | null> {
  if (!env.CACHE) return null;
  try {
    const key = providerCacheKey(protocol, limit);
    const raw = await env.CACHE.get(key);
    if (!raw) return null;
    const { posts } = JSON.parse(raw) as { posts: UnifiedPost[]; fetchedAt: number };
    return posts;
  } catch (err) {
    // Non-critical cache read — log and continue
    console.warn('[feed] readProviderCache failed:', err instanceof Error ? err.message : err);
  }
  return null;
}

async function writeProviderCache(
  env: Env,
  protocol: string,
  limit: number,
  posts: UnifiedPost[],
): Promise<void> {
  if (!env.CACHE || posts.length === 0) return;
  try {
    const key = providerCacheKey(protocol, limit);
    await env.CACHE.put(key, JSON.stringify({ posts, fetchedAt: Date.now() }), {
      expirationTtl: CACHE_PROVIDER_TTL,
    });
  } catch (err) {
    // Non-critical cache write — log and continue
    console.warn('[feed] writeProviderCache failed:', err instanceof Error ? err.message : err);
  }
}

// ─── Post KV store ─────────────────────────────────────────────────
// After dedup, every post is written to KV for O(1) ID lookups.

async function writePostsToKV(env: Env, posts: UnifiedPost[]): Promise<void> {
  if (!env.CACHE || posts.length === 0) return;
  try {
    const puts = posts
      .slice(0, 100)
      .map((p) =>
        env.CACHE?.put(`post:${p.id}`, JSON.stringify(p), { expirationTtl: 3600 }).catch(() => {}),
      );
    await Promise.allSettled(puts);
  } catch (err) {
    // Non-critical cache write — log and continue
    console.warn('[feed] writePostsToKV failed:', err instanceof Error ? err.message : err);
  }
}

export async function handleHomeFeed(
  request: Request,
  env: Env,
  execCtx?: { waitUntil: (p: Promise<unknown>) => void },
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'), DEFAULT_PROTOCOLS);
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const category = params.get('category')?.toLowerCase() ?? '';
  const prefs = parsePrefsFromQuery(params);
  const diverse = params.get('diverse') !== 'false';
  const queryAllowNonCrypto = params.get('allowNonCrypto') === 'true';
  const sort = params.get('sort') || 'scored'; // scored | hot | new | top
  const cursor = Number(params.get('cursor')) || 0;
  const direction = params.get('direction') === 'asc' ? 'asc' : 'desc';

  // Anonymous cookie preferences: personalized feed without sign-in.
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookieMatch = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('df_prefs='));
  let cookiePrefs: UserAlgorithmPreferences | null = null;
  if (cookieMatch) {
    try {
      cookiePrefs = JSON.parse(
        decodeURIComponent(cookieMatch.slice('df_prefs='.length)),
      ) as UserAlgorithmPreferences;
    } catch (err) {
      console.warn('[feed] cookie prefs parse failed:', err instanceof Error ? err.message : err);
    }
  }

  const allPosts: UnifiedPost[] = [];
  const errors: string[] = [];
  const perProtocol: Record<string, number> = {};
  const notices: string[] = [];

  // Feed-level cache: skip all provider fetches if we have a fresh result.
  const feedCacheKey = `feed:v1:${requestedProtocols.join(',')}:${category}:${sort}`;
  if (env.CACHE && !cursor) {
    try {
      const cached = await env.CACHE.get(feedCacheKey);
      if (cached) {
        const { data, meta } = JSON.parse(cached) as {
          data: unknown;
          meta: Record<string, unknown>;
        };
        if (Date.now() - (meta.fetchedAt as number) < 30_000) {
          return jsonResponse({ data, meta });
        }
      }
    } catch (err) {
      console.warn('[feed] feed cache read failed:', err instanceof Error ? err.message : err);
    }
  }

  const results = await Promise.allSettled(
    requestedProtocols.map(async (protocol) => {
      if (await isCircuitOpen(env, protocol)) {
        return { protocol, posts: [] as UnifiedPost[], skipped: true };
      }

      const cachedPosts = await readProviderCache(env, protocol, limit);
      if (cachedPosts) {
        void resetCircuit(env, protocol);
        const refreshP = (async () => {
          try {
            const provider = getProvider(protocol, env);
            const result = await provider.fetchFeed({
              timeoutMs: DEFAULT_TIMEOUT_MS,
              concurrency: 4,
            });
            const filtered = result.posts.filter((p) => !isSpamPost(p)).map(enrichPostNiches);
            if (result.notice) notices.push(result.notice);
            void resetCircuit(env, protocol);
            await writeProviderCache(env, protocol, limit, filtered);
          } catch (err) {
            console.error(
              '[feed] provider fetch failed (background refresh):',
              protocol,
              err instanceof Error ? err.message : err,
            );
            void incrCircuit(env, protocol);
          }
        })();
        if (execCtx?.waitUntil) {
          execCtx.waitUntil(refreshP);
        } else {
          void refreshP;
        }
        return { protocol, posts: cachedPosts };
      }

      try {
        const provider = getProvider(protocol, env);
        const result = await provider.fetchFeed({
          timeoutMs: DEFAULT_TIMEOUT_MS,
          concurrency: 4,
        });
        const filtered = result.posts.filter((p) => !isSpamPost(p)).map(enrichPostNiches);
        if (result.notice) notices.push(result.notice);
        void resetCircuit(env, protocol);
        void writeProviderCache(env, protocol, limit, filtered);
        return { protocol, posts: filtered };
      } catch (err) {
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
  // Content type filter: ?type=video|article|image|thread|link|text
  const typeFilter = params.get('type') || '';
  if (typeFilter) {
    deduped = deduped.filter((p) => detectContentType(p) === typeFilter);
  }
  // Write posts to KV for O(1) ID lookups.
  void writePostsToKV(env, deduped);
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
  let relevant = allowNonCrypto ? deduped : deduped.filter(isRelevantPost);

  // Language filter: check Accept-Language header, default to English-only.
  // Users can opt into all languages with ?lang=all.
  const langParam = params.get('lang') || '';
  const acceptLang = request.headers.get('accept-language') || '';
  const preferEnglish =
    langParam !== 'all' && (langParam === 'en' || acceptLang.startsWith('en') || !langParam);
  if (preferEnglish) {
    relevant = relevant.filter((p) => isEnglishPost(p.text));
  }

  // Fetch Nostr zap counts for engagement enrichment before scoring.
  const nostrIds = relevant
    .filter((p) => p.protocol === 'nostr')
    .map((p) => p.id.replace('nostr:', ''));
  if (nostrIds.length > 0) {
    try {
      const res = await fetch('https://api.nostr.band/v0/stats/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: nostrIds.slice(0, 50) }),
      });
      if (res.ok) {
        const stats = (await res.json()) as Record<
          string,
          { reactions?: number; reposts?: number; replies?: number; zaps?: number }
        >;
        for (const p of relevant) {
          if (p.protocol !== 'nostr') continue;
          const nativeId = p.id.replace('nostr:', '');
          const s = stats[nativeId];
          if (s) {
            if (s.zaps) p.metrics.quotes = s.zaps;
            if (s.reactions) p.metrics.likes = Math.max(p.metrics.likes, s.reactions);
            if (s.reposts) p.metrics.reposts = Math.max(p.metrics.reposts, s.reposts);
            if (s.replies) p.metrics.replies = Math.max(p.metrics.replies, s.replies);
          }
        }
      }
    } catch (err) {
      console.warn(
        '[feed] nostr.band stats fetch failed:',
        err instanceof Error ? err.message : err,
      );
    }
  }

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
  // Merge anonymous cookie preferences (lowest priority — overridden by query params and auth'd prefs)
  if (cookiePrefs) {
    for (const n of cookiePrefs.preferredNiches) {
      if (!mergedPrefs.preferredNiches.includes(n)) mergedPrefs.preferredNiches.push(n);
    }
    for (const p of cookiePrefs.preferredPlatforms) {
      if (!mergedPrefs.preferredPlatforms.includes(p)) mergedPrefs.preferredPlatforms.push(p);
    }
    if (cookiePrefs.recencyWeight) mergedPrefs.recencyWeight = cookiePrefs.recencyWeight;
    if (cookiePrefs.engagementWeight) mergedPrefs.engagementWeight = cookiePrefs.engagementWeight;
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
      const results = await Promise.allSettled(keys.map((k) => env.CACHE?.get(k)));
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
          } catch (err) {
            // Non-critical — log and continue
            console.warn(
              '[feed] previousEngagement parse failed:',
              err instanceof Error ? err.message : err,
            );
          }
        }
      }
    } catch (err) {
      console.warn(
        '[feed] previousEngagement KV fetch failed:',
        err instanceof Error ? err.message : err,
      );
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
      env.CACHE?.put(
        `eng:${p.id}`,
        JSON.stringify({
          likes: p.metrics.likes,
          reposts: p.metrics.reposts,
          replies: p.metrics.replies,
          at: now,
        }),
        { expirationTtl: 300 },
      ).catch(() => {}),
    );
    await Promise.allSettled(puts);
  })();
  // Cursor-based pagination: filter posts by createdAt relative to cursor.
  let cursorScored = scoredRelevant;
  if (cursor > 0) {
    cursorScored =
      direction === 'asc'
        ? scoredRelevant.filter((s) => s.post.createdAt > cursor)
        : scoredRelevant.filter((s) => s.post.createdAt < cursor);
  }

  // Sort modes. 'scored' uses the diversity ranker; 'hot'/'top'/'new' are
  // simple sorts that bypass the diversity algorithm so the user sees exactly
  // what they asked for (but we still apply the low-quality filter first).
  const filteredScored = hideLowQuality
    ? cursorScored.filter((s) => s.breakdown.total >= hideLowQualityThreshold)
    : cursorScored;

  const rankedPosts = (() => {
    if (sort === 'new') {
      return [...filteredScored]
        .sort((a, b) => b.post.createdAt - a.post.createdAt)
        .map((s) => s.post)
        .slice(0, Math.min(limit, 100));
    }
    if (sort === 'top') {
      return [...filteredScored]
        .sort((a, b) => b.breakdown.engagement - a.breakdown.engagement)
        .map((s) => s.post)
        .slice(0, Math.min(limit, 100));
    }
    if (sort === 'hot') {
      return [...filteredScored]
        .sort((a, b) => b.breakdown.total - a.breakdown.total)
        .map((s) => s.post)
        .slice(0, Math.min(limit, 100));
    }
    // Default 'scored': use diversity ranker
    return (
      diverse
        ? rankDiverse(
            filteredScored.map((s) => s.post),
            ctx,
            {
              maxPerAuthor: 2,
              perProtocolMin: { farcaster: 2, lens: 2, bluesky: 2, nostr: 2, lemmy: 2 },
            },
          )
        : filteredScored.map((s) => s.post)
    ).slice(0, Math.min(limit, 100));
  })();
  // Attach score breakdowns by id lookup
  const scoreById = new Map(filteredScored.map((s) => [s.post.id, s.breakdown]));
  const ranked = rankedPosts.map((p) => {
    const breakdown = scoreById.get(p.id);
    if (!breakdown) return p;
    const now = Date.now();
    const ageMin = (now - p.createdAt) / 60000;
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
      isNew: ageMin < 15,
      isHot: breakdown.velocity > 2.0,
      isTrending: breakdown.engagement > 3,
    };
  });
  const trendingWindow = Number(params.get('trending')) || 24; // hours
  const trending = computeTrendingTopics(relevant, Date.now(), 12, trendingWindow * 3600000);
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
  } catch (err) {
    console.warn(
      '[feed] Mastodon trending tags fetch failed:',
      err instanceof Error ? err.message : err,
    );
  }
  // Top-of-hour: highest-scoring post from the last 60 minutes.
  const now = Date.now();
  const recentPosts = filteredScored.filter((s) => now - s.post.createdAt < 3600000);
  const topOfHour =
    recentPosts.length > 0
      ? recentPosts.reduce((best, cur) => (cur.breakdown.total > best.breakdown.total ? cur : best))
          .post.id
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

  const nextCursor = ranked.length > 0 ? ranked[ranked.length - 1]?.createdAt : null;

  // New posts since last visit: reads a cookie, counts newer posts.
  const lastVisitCookie = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('df_last_visit='));
  let newSinceLastVisit = 0;
  if (lastVisitCookie) {
    const lastVisit = Number(lastVisitCookie.slice('df_last_visit='.length));
    if (lastVisit > 0) newSinceLastVisit = ranked.filter((p) => p.createdAt > lastVisit).length;
  }

  const responseBody = {
    data: ranked,
    meta: {
      total: ranked.length,
      limit,
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      trending,
      topOfHour,
      nextCursor,
      sort,
      newSinceLastVisit,
      fetchedAt: Date.now(),
    },
  };

  // Write feed-level cache for subsequent requests.
  if (env.CACHE && !cursor) {
    try {
      await env.CACHE.put(feedCacheKey, JSON.stringify(responseBody), { expirationTtl: 45 });
    } catch (err) {
      // Non-critical cache write — log and continue
      console.warn('[feed] feed cache write failed:', err instanceof Error ? err.message : err);
    }
  }

  return cachedJsonResponse(responseBody);
}

function cachedJsonResponse(data: unknown, status = 200, maxAge = 30): Response {
  const body = JSON.stringify(data);
  const hash = String(body.length);
  return new Response(body, {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      etag: `"${hash}"`,
      vary: 'Accept-Language',
    },
  });
}

// Replace the final return in handleHomeFeed — use cachedJsonResponse instead of jsonResponse.
// (applied below)

export async function handleTrendingFeed(
  request: Request,
  env: Env,
  execCtx?: { waitUntil: (p: Promise<unknown>) => void },
): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set('protocols', DEFAULT_PROTOCOLS.join(','));
  return handleHomeFeed(new Request(url.toString()), env, execCtx);
}

export async function handleCategoryFeed(
  request: Request,
  env: Env,
  category: string,
  execCtx?: { waitUntil: (p: Promise<unknown>) => void },
): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set('category', category);
  return handleHomeFeed(new Request(url.toString()), env, execCtx);
}

export async function handleRedditFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const subreddit = params.get('subreddit');
  const limit = Math.min(Number(params.get('limit')) || 25, 100);
  const cacheKey = `reddit:v1:${subreddit || 'all'}:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch (err) {
    console.warn('[feed] reddit cache read failed:', err instanceof Error ? err.message : err);
  }

  const { RedditProvider } = (await import('@degenfeed/feed-providers')) as unknown as {
    RedditProvider: new (options?: {
      subreddits?: string[];
      redlibUrl?: string;
    }) => {
      fetchFeed: (opts?: {
        timeoutMs?: number;
      }) => Promise<{ posts: import('@degenfeed/types').UnifiedPost[]; notice?: string }>;
    };
  };
  const provider = subreddit
    ? new RedditProvider({ subreddits: [subreddit], redlibUrl: env.REDLIB_URL })
    : new RedditProvider({ redlibUrl: env.REDLIB_URL });
  let posts: UnifiedPost[] = [];
  try {
    const result = await provider.fetchFeed({ timeoutMs: 5000 });
    posts = result.posts.slice(0, limit);
  } catch (_err) {
    return jsonResponse({
      data: [],
      meta: { total: 0, limit, subreddit: subreddit || 'all', error: 'Reddit provider failed' },
    });
  }
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
  } catch (err) {
    // Non-critical cache write — log and continue
    console.warn('[feed] reddit cache write failed:', err instanceof Error ? err.message : err);
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
  } catch (err) {
    console.warn('[feed] readCachedHealth failed:', err instanceof Error ? err.message : err);
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
  } catch (err) {
    // Non-critical cache write — log and continue
    console.warn('[feed] writeCachedHealth failed:', err instanceof Error ? err.message : err);
  }
}
