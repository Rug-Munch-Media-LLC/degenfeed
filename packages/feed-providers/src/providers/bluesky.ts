import {
  buildUnifiedPost,
  CircuitBreaker,
  CircuitBreakerError,
  enrichPostNiches,
} from '@degenfeed/feed-core';
import type { MediaAttachment, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import { isBskyPostView } from '../schemas';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  fetchJson,
  withConcurrencyLimit,
  withRetry,
  withTimeout,
} from '../utils';

export const BSKY_PUBLIC_URL = 'https://public.api.bsky.app';
export const BSKY_SOCIAL_URL = 'https://bsky.social';

/**
 * Additional public ATProto AppView/PDS endpoints used as fallback
 * sources when the primary endpoint fails. All of these serve the
 * public read XRPC endpoints (getFeed, getAuthorFeed, searchPosts,
 * getProfile) unauthenticated.
 */
export const BSKY_APPVIEW_FALLBACKS = [
  'https://public.api.bsky.app',
  'https://api.bsky.app',
  'https://bsky.social',
];

/**
 * Curated feed generators (custom algorithm feeds) fetched via
 * `app.bsky.feed.getFeed`. Each entry is an AT-URI of the form
 * `at://<did>/app.bsky.feed.generator/<record_key>`.
 *
 * All official feeds below are owned by bsky.app
 * (did:plc:z72i7hdynmk6r22z27h6tvur), resolved 2026-08-06 via
 * `app.bsky.feed.getActorFeeds?actor=bsky.app`:
 *
 * - `whats-hot`     — "Discover" (official, public)
 * - `hot-classic`   — "What's Hot Classic" (official, public)
 * - `bsky-team`     — posts from Bluesky team members (official, public)
 * - `thevids`       — trending short-form video feed (official; replaces
 *   the old `video-feed` record key which now returns 400)
 * - `with-friends`  — "Popular With Friends" (personalized — requires a
 *   session; skipped gracefully when no accessJwt is available)
 * - `mutuals`       — "Mutuals" (personalized — requires a session)
 * - `best-of-follows` — "Best of Follows" (personalized — requires a session)
 *
 * Operators can pass additional crypto/tech feed generator AT-URIs via
 * `BlueskyProviderOptions.feedUris`.
 */
export const CURATED_BSKY_FEEDS = [
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/hot-classic',
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/bsky-team',
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/thevids',
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends',
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/mutuals',
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/best-of-follows',
];

/**
 * ATProto relay / trending content.
 *
 * The official `trending.bsky.app` actor publishes one feed generator
 * per live trending topic (resolved via `app.bsky.unspecced
 * .getTrendingTopics`). Each topic's `link` points at
 * `/profile/trending.bsky.app/feed/<recordKey>`, which we convert into
 * an AT-URI and fetch via `app.bsky.feed.getFeed`. This gives us a
 * dynamic, always-fresh source of the most popular posts network-wide
 * (ATProto relay content), independent of keyword searches.
 */
export const BSKY_TRENDING_ACTOR_DID = 'did:plc:qrz3lhbyuxbeilrc6nekdqme';

export const CURATED_BSKY_ACTORS = [
  'jay.bsky.social',
  'naval.bsky.social',
  'balajis.com',
  'vitalik.eth.xyz',
  'a16z.com',
  'coinbase.com',
  'solana.com',
  'joe.bsky.social',
  'shipyard.bsky.social',
  'dappgem.bsky.social',
  'defi.bsky.social',
  'mert.bsky.social',
  'ansem.bsky.social',
  'blknoiz06.bsky.social',
  'pmarca.bsky.social',
  'cdixon.bsky.social',
  'spencernoon.bsky.social',
  'autismcapital.bsky.social',
  'tier10k.bsky.social',
  'karbonbased.bsky.social',
  'lisafed.bsky.social',
  'mollywhite.bsky.social',
  'defiprime.bsky.social',
  'mehowbrian.bsky.social',
  'crypto_birb.bsky.social',
];

export const CRYPTO_SEARCH_QUERIES = [
  'bitcoin OR btc',
  'ethereum OR eth',
  'solana OR sol',
  'crypto',
  'defi',
  'nft',
  'web3',
];

interface BskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface BskyPostView {
  uri: string;
  cid: string;
  author: BskyAuthor;
  record: {
    text: string;
    createdAt: string;
    embed?: {
      type?: string;
      external?: { uri: string; title?: string; description?: string; thumb?: string };
      images?: { image: { ref: string }; alt: string }[];
    };
    reply?: { parent: { uri: string }; root: { uri: string } };
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
}

function authorToIdentity(author: BskyAuthor): UnifiedIdentity {
  return {
    id: `bluesky:${author.did}`,
    primary: { protocol: 'bluesky', id: author.did },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: author.handle,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: author.displayName || author.handle,
    bio: '',
    avatarUrl: author.avatar || '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: { did: author.did },
  };
}

function postToUnifiedPost(post: BskyPostView): UnifiedPost {
  const embeds: { kind: 'image' | 'link'; url: string; meta?: Record<string, unknown> }[] = [];
  const media: MediaAttachment[] = [];
  if (post.record.embed?.external) {
    embeds.push({
      kind: 'link',
      url: post.record.embed.external.uri,
      meta: {
        title: post.record.embed.external.title,
        description: post.record.embed.external.description,
      },
    });
    // Link card thumbnail
    const external = post.record.embed.external as { thumb?: string };
    if (external.thumb) {
      media.push({ type: 'image', url: external.thumb });
    }
  }
  if (post.record.embed?.images) {
    for (const img of post.record.embed.images) {
      const thumb = `https://cdn.bsky.app/img/feed_thumbnail/plain/${img.image.ref}@jpeg`;
      embeds.push({
        kind: 'image',
        url: thumb,
        meta: { alt: img.alt },
      });
      media.push({ type: 'image', url: thumb, alt: img.alt });
    }
  }

  return buildUnifiedPost({
    protocol: 'bluesky',
    nativeId: post.uri,
    author: authorToIdentity(post.author),
    text: post.record.text,
    parentNativeId: post.record.reply?.parent.uri,
    rootNativeId: post.record.reply?.root.uri,
    createdAt: new Date(post.record.createdAt).getTime(),
    metrics: {
      likes: post.likeCount ?? 0,
      reposts: post.repostCount ?? 0,
      replies: post.replyCount ?? 0,
      quotes: 0,
    },
    viewer: { liked: false, reposted: false },
    raw: post,
    embeds,
    media,
  });
}

async function fetchAuthorFeed(
  baseUrl: string,
  actor: string,
  limit: number,
  accessJwt?: string,
): Promise<BskyPostView[]> {
  const url = buildUrl(baseUrl, '/xrpc/app.bsky.feed.getAuthorFeed', {
    actor,
    limit: String(Math.min(limit, 100)),
  });
  const headers: Record<string, string> = {};
  if (accessJwt) headers.authorization = `Bearer ${accessJwt}`;
  const data = await fetchJson<{ feed?: Array<{ post: BskyPostView }> }>(url, { headers });
  return (data.feed ?? []).map((f) => f.post);
}

async function searchPosts(
  baseUrl: string,
  q: string,
  limit: number,
  accessJwt?: string,
): Promise<BskyPostView[]> {
  const url = buildUrl(baseUrl, '/xrpc/app.bsky.feed.searchPosts', {
    q,
    limit: String(Math.min(limit, 100)),
    sort: 'latest',
  });
  const headers: Record<string, string> = {};
  if (accessJwt) headers.authorization = `Bearer ${accessJwt}`;
  const data = await fetchJson<{ posts?: BskyPostView[] }>(url, { headers });
  return data.posts ?? [];
}

/**
 * Fetch posts from a feed generator (custom algorithm feed) via
 * `app.bsky.feed.getFeed`. The response shape matches the author-feed
 * envelope: `{ feed: Array<{ post: BskyPostView }>, cursor? }`.
 */
async function fetchFeedGenerator(
  baseUrl: string,
  feedUri: string,
  limit: number,
  accessJwt?: string,
): Promise<BskyPostView[]> {
  const url = buildUrl(baseUrl, '/xrpc/app.bsky.feed.getFeed', {
    feed: feedUri,
    limit: String(Math.min(limit, 100)),
  });
  const headers: Record<string, string> = {};
  if (accessJwt) headers.authorization = `Bearer ${accessJwt}`;
  const data = await fetchJson<{ feed?: Array<{ post: BskyPostView }> }>(url, { headers });
  return (data.feed ?? []).map((f) => f.post);
}

/**
 * Fetch the currently trending posts from the ATProto network.
 *
 * Resolves live trending topics via `app.bsky.unspecced.getTrendingTopics`,
 * converts each topic's `/profile/trending.bsky.app/feed/<recordKey>` link
 * into an AT-URI, then fetches up to 2 trending feed generators. This
 * surfaces the most popular posts network-wide right now (relay content),
 * independent of our crypto keyword searches.
 */
async function fetchTrendingFeedPosts(
  baseUrl: string,
  limit: number,
  accessJwt?: string,
): Promise<BskyPostView[]> {
  const topicsUrl = buildUrl(baseUrl, '/xrpc/app.bsky.unspecced.getTrendingTopics', {
    limit: '8',
  });
  const headers: Record<string, string> = {};
  if (accessJwt) headers.authorization = `Bearer ${accessJwt}`;
  const topics = await fetchJson<{ topics?: Array<{ topic?: string; link?: string }> }>(topicsUrl, {
    headers,
  });

  const feedUris = (topics.topics ?? [])
    .map((t) => t.link ?? '')
    .filter((link) => /\/profile\/trending\.bsky\.app\/feed\/[A-Za-z0-9]+$/.test(link))
    .slice(0, 2)
    .map((link) => {
      const recordKey = link.split('/').pop() ?? '';
      return `at://${BSKY_TRENDING_ACTOR_DID}/app.bsky.feed.generator/${recordKey}`;
    });

  if (feedUris.length === 0) return [];

  const results = await withConcurrencyLimit(
    feedUris,
    2,
    async (feedUri) => {
      try {
        return await fetchFeedGenerator(baseUrl, feedUri, Math.max(5, Math.ceil(limit / 2)), accessJwt);
      } catch {
        return [] as BskyPostView[];
      }
    },
  );
  return results.flat().filter((p): p is BskyPostView => Boolean(p));
}

export interface BlueskyProviderOptions {
  baseUrl?: string;
  fallbackUrl?: string;
  /** Additional fallback AppView/PDS endpoints (defaults to BSKY_APPVIEW_FALLBACKS). */
  fallbackUrls?: string[];
  accessJwt?: string;
  curatedActors?: string[];
  /** Feed generator AT-URIs to fetch (defaults to CURATED_BSKY_FEEDS). */
  feedUris?: string[];
}

export class BlueskyProvider implements FeedProvider {
  readonly protocol: Protocol = 'bluesky';
  readonly schema: SchemaGuard = isBskyPostView;
  private readonly primaryUrl: string;
  private readonly fallbackUrls: string[];
  private readonly accessJwt?: string;
  private readonly curatedActors: string[];
  private readonly feedUris: string[];
  private readonly breaker = new CircuitBreaker('bluesky');

  constructor(options: BlueskyProviderOptions = {}) {
    this.primaryUrl = options.baseUrl || BSKY_PUBLIC_URL;
    this.accessJwt = options.accessJwt;
    this.curatedActors = options.curatedActors ?? CURATED_BSKY_ACTORS;
    this.feedUris = options.feedUris ?? CURATED_BSKY_FEEDS;
    // Include the primary URL first, then the caller's fallback URL, then defaults
    const defaults = BSKY_APPVIEW_FALLBACKS.filter((u) => u !== this.primaryUrl);
    if (options.fallbackUrl && options.fallbackUrl !== this.primaryUrl) {
      this.fallbackUrls = [options.fallbackUrl, ...defaults.filter((u) => u !== options.fallbackUrl)];
    } else {
      this.fallbackUrls = defaults;
    }
  }

  /** Run a fetcher against the primary AppView, falling back to other endpoints on failure. */
  private async withFallback<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const baseUrl of [this.primaryUrl, ...this.fallbackUrls]) {
      try {
        return await fn(baseUrl);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('All Bluesky endpoints failed');
  }

  async fetch(opts: FetchOptions = {}): Promise<unknown> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = 50;
    return withRetry(async () => {
      const all: BskyPostView[] = [];

      // 1. Crypto keyword search (existing behavior, primary signal)
      const queries = CRYPTO_SEARCH_QUERIES.slice(0, 4);
      const searchResults = await withConcurrencyLimit(
        queries,
        Math.min(2, queries.length),
        async (q) => {
          try {
            return await withTimeout(
              this.withFallback((baseUrl) =>
                searchPosts(baseUrl, q, Math.max(5, Math.ceil(limit / queries.length)), this.accessJwt),
              ),
              timeoutMs,
              `bluesky:search:${q}`,
            );
          } catch {
            return [] as BskyPostView[];
          }
        },
      );
      for (const r of searchResults) all.push(...r);

      // 2. Feed generators (What's Hot + curated feeds) — new 2026-08-06
      const feedResults = await withConcurrencyLimit(
        this.feedUris.slice(0, 6),
        2,
        async (feedUri) => {
          try {
            return await withTimeout(
              this.withFallback((baseUrl) =>
                fetchFeedGenerator(baseUrl, feedUri, Math.max(5, Math.ceil(limit / 2)), this.accessJwt),
              ),
              timeoutMs,
              `bluesky:feed:${feedUri}`,
            );
          } catch {
            return [] as BskyPostView[];
          }
        },
      );
      for (const r of feedResults) all.push(...r);

      // 2.5. ATProto relay / trending topics (new 2026-08-06) — dynamic
      //      trending feed generators from trending.bsky.app. Always
      //      best-effort: failures never block the main feed.
      try {
        const trendingPosts = await withTimeout(
          this.withFallback((baseUrl) =>
            fetchTrendingFeedPosts(baseUrl, Math.max(5, Math.ceil(limit / 3)), this.accessJwt),
          ),
          timeoutMs,
          'bluesky:trending-topics',
        );
        all.push(...trendingPosts);
      } catch {
        /* best-effort */
      }

      // 3. Curated actors (only if we still need more posts)
      if (all.length < limit / 2) {
        const actors = this.curatedActors.slice(0, 8);
        const actorResults = await withConcurrencyLimit(actors, 3, async (actor) => {
          try {
            return await withTimeout(
              this.withFallback((baseUrl) =>
                fetchAuthorFeed(baseUrl, actor, Math.max(3, Math.ceil(limit / actors.length)), this.accessJwt),
              ),
              timeoutMs,
              `bluesky:${actor}`,
            );
          } catch {
            return [] as BskyPostView[];
          }
        });
        for (const r of actorResults) all.push(...r);
      }

      return all;
    });
  }

  transform(raw: unknown): UnifiedPost[] {
    const posts = Array.isArray(raw) ? (raw as BskyPostView[]) : [];
    return posts.map((p) => enrichPostNiches(postToUnifiedPost(p)));
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const posts = this.transform(await this.fetch(opts));
        return { posts };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Bluesky: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Bluesky feed unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(
          buildUrl(this.primaryUrl, '/xrpc/app.bsky.actor.getProfile', { actor: 'bsky.app' }),
        ),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'bluesky:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
