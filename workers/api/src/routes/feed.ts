import { BskyClient, CURATED_BSKY_ACTORS } from '@degenfeed/bluesky-sdk';
import { CURATED_FARCASTER_FIDS, fetchFarcasterCuratedFeed } from '@degenfeed/farcaster-sdk';
import { deduplicatePosts, enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import { CURATED_LENS_HANDLES, LensClient, type LensProfile } from '@degenfeed/lens-sdk';
import { GtSClient } from '@degenfeed/mastodon-sdk';
import { RelayPool } from '@degenfeed/nostr-sdk';
import { type UserAlgorithmPreferences, rank } from '@degenfeed/ranking';
import { DEFAULT_SUBREDDITS, RedditSource, feedToUnifiedPosts } from '@degenfeed/rss-sdk';
import { CURATED_THREADS_HANDLES, ThreadsClient } from '@degenfeed/threads-sdk';
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

const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
];

const FALLBACK_HUBS = [
  'https://hub.farcaster.standardcrypto.vc:2281',
  'https://hoyt.farcaster.standardcrypto.vc:2281',
  'https://hub-grpc.pinata.cloud',
];

const LENS_FALLBACK = ['https://api.lens.xyz/graphql', 'https://api-v2.lens.dev/graphql'];
const BSKY_FALLBACK = 'https://public.api.bsky.app';
const GTS_INSTANCE = 'https://social.degenfeed.xyz';
const THREADS_FALLBACK = 'https://public.threads.net';
const DEFAULT_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });
  return Promise.race([promise, timeout]);
}

function parseProtocols(raw: string | null): Protocol[] {
  if (!raw) return DEFAULT_PROTOCOLS;
  const parts = raw.split(',').map((p) => p.trim()) as Protocol[];
  const valid = new Set<Protocol>(DEFAULT_PROTOCOLS);
  return parts.filter((p): p is Protocol => valid.has(p));
}

async function fetchNostr(
  env: Env,
  limit: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<UnifiedPost[]> {
  const relayUrls = (env.RELAY_URLS ?? '').split(',').filter(Boolean);
  const pool = new RelayPool(relayUrls.length > 0 ? relayUrls : FALLBACK_RELAYS, {
    eoseTimeout: 2000,
  });
  try {
    const events = await withTimeout(
      pool.list({ kinds: [1], limit: limit * 3 }, 3000),
      timeoutMs,
      'nostr',
    );
    const posts: UnifiedPost[] = [];
    for (const ev of events) {
      const post: UnifiedPost = {
        id: `nostr:${ev.id}`,
        protocol: 'nostr',
        author: {
          id: `nostr:${ev.pubkey}`,
          primary: { protocol: 'nostr', id: ev.pubkey },
          handles: {
            nostr: ev.pubkey,
            farcaster: null,
            lens: null,
            bluesky: null,
            threads: null,
            rss: null,
            mastodon: null,
          },
          displayName: ev.pubkey.slice(0, 12),
          bio: '',
          avatarUrl: '',
          verified: [],
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: { nostrPubkey: ev.pubkey },
        },
        text: ev.content,
        embeds: [],
        createdAt: ev.created_at * 1000,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: ev,
        niches: [],
      };
      if (!isSpamPost(post)) posts.push(enrichPostNiches(post));
    }
    return posts;
  } finally {
    pool.disconnectAll();
  }
}

async function fetchFarcaster(
  env: Env,
  limit: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ posts: UnifiedPost[]; notice?: string }> {
  const hubUrl = env.FARCASTER_HUB_URL || FALLBACK_HUBS[0];
  const result = await Promise.race([
    fetchFarcasterCuratedFeed(hubUrl, CURATED_FARCASTER_FIDS, Math.max(3, Math.ceil(limit / 6))),
    new Promise<{ posts: UnifiedPost[]; notice?: string }>((resolve) =>
      setTimeout(() => resolve({ posts: [], notice: 'Farcaster fetch timed out' }), timeoutMs),
    ),
  ]);
  return result;
}

async function fetchLens(
  env: Env,
  limit: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<UnifiedPost[]> {
  const url = env.LENS_API_URL || LENS_FALLBACK[0];
  const client = new LensClient(url);
  const pubs = await withTimeout(
    client.getPublicationsByHandles(CURATED_LENS_HANDLES, Math.ceil(limit / 2)),
    timeoutMs,
    'lens',
  );
  const profileCache = new Map<string, LensProfile>();
  const posts: UnifiedPost[] = [];
  for (const pub of pubs) {
    let profile = profileCache.get(pub.by.id);
    if (!profile) {
      profile = {
        id: pub.by.id,
        handle: pub.by.handle,
        metadata: pub.by.metadata,
      };
      profileCache.set(pub.by.id, profile);
    }
    const author = client.profileToIdentity(profile);
    posts.push(enrichPostNiches(client.publicationToUnifiedPost(pub, author)));
  }
  return posts;
}

async function fetchBluesky(
  env: Env,
  limit: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<UnifiedPost[]> {
  const url = env.BSKY_PUBLIC_URL || BSKY_FALLBACK;
  const client = new BskyClient(url);
  let posts = await withTimeout(
    client.getActorFeeds(CURATED_BSKY_ACTORS, Math.max(3, Math.ceil(limit / 5))),
    timeoutMs,
    'bluesky',
  );
  if (posts.length === 0) {
    const search = await withTimeout(
      client.searchActorsTypeahead('crypto', 10),
      timeoutMs,
      'bluesky-search',
    );
    const actors = search.actors.map((a) => a.handle).slice(0, 5);
    if (actors.length > 0) {
      posts = await client.getActorFeeds(actors, 5);
    }
  }
  const unified: UnifiedPost[] = [];
  for (const post of posts) {
    unified.push(enrichPostNiches(client.postToUnifiedPost(post)));
  }
  return unified;
}

const PUBLIC_MASTODON_FALLBACKS = ['https://fosstodon.org'];

async function fetchMastodon(
  env: Env,
  limit: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<UnifiedPost[]> {
  const instances = [env.GTS_INSTANCE_URL || GTS_INSTANCE, ...PUBLIC_MASTODON_FALLBACKS];
  const { statusToUnifiedPost } = await import('@degenfeed/mastodon-sdk');
  for (const instance of instances) {
    try {
      const client = new GtSClient(instance);
      const statuses = await withTimeout(client.getPublicTimeline(limit), timeoutMs, 'mastodon');
      if (statuses.length > 0) {
        return statuses.map((s) => enrichPostNiches(statusToUnifiedPost(s, instance)));
      }
    } catch {
      /* try next instance */
    }
  }
  return [];
}

async function fetchThreads(
  env: Env,
  limit: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<UnifiedPost[]> {
  const url = env.THREADS_PDS_URL || THREADS_FALLBACK;
  const client = new ThreadsClient(url);
  const posts = await withTimeout(
    client.getAuthorFeeds(CURATED_THREADS_HANDLES, Math.max(2, Math.ceil(limit / 6))),
    timeoutMs,
    'threads',
  );
  const unified: UnifiedPost[] = [];
  for (const post of posts) {
    unified.push(enrichPostNiches(client.postToUnifiedPost(post)));
  }
  return unified;
}

async function fetchRss(
  _env: Env,
  limit: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<UnifiedPost[]> {
  const subreddits = DEFAULT_SUBREDDITS;
  const results = await Promise.allSettled(
    subreddits.map((sub) =>
      withTimeout(
        RedditSource.fetch(sub, 'hot', Math.ceil(limit / subreddits.length)),
        timeoutMs,
        `rss:${sub}`,
      ),
    ),
  );
  const posts: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      posts.push(...feedToUnifiedPosts(r.value));
    }
  }
  return posts.slice(0, limit).map(enrichPostNiches);
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

  const fetchers: {
    protocol: Protocol;
    fn: () => Promise<UnifiedPost[] | { posts: UnifiedPost[]; notice?: string }>;
  }[] = [
    { protocol: 'nostr', fn: () => fetchNostr(env, limit) },
    { protocol: 'farcaster', fn: () => fetchFarcaster(env, limit) },
    { protocol: 'lens', fn: () => fetchLens(env, limit) },
    { protocol: 'bluesky', fn: () => fetchBluesky(env, limit) },
    { protocol: 'mastodon', fn: () => fetchMastodon(env, limit) },
    { protocol: 'threads', fn: () => fetchThreads(env, limit) },
    { protocol: 'rss', fn: () => fetchRss(env, limit) },
  ];

  const activeFetchers = fetchers.filter((f) => requestedProtocols.includes(f.protocol));
  const results = await Promise.allSettled(
    activeFetchers.map((f) =>
      f.fn().then((result) => {
        if ('posts' in result) {
          if (result.notice) notices.push(result.notice);
          return { protocol: f.protocol, posts: result.posts };
        }
        return { protocol: f.protocol, posts: result };
      }),
    ),
  );

  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      const { protocol, posts } = result.value;
      perProtocol[protocol] = posts.length;
      allPosts.push(...posts);
    } else {
      const protocol = activeFetchers[index]?.protocol ?? 'unknown';
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
