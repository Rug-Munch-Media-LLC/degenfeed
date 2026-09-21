/**
 * Bluesky Fetchers
 *
 * Full AT Protocol content pull:
 *  1. Local PDS repos (com.atproto.repo.listRecords)
 *  2. Authenticated home timeline via PDS (app.bsky.feed.getTimeline)
 *  3. "What's Hot" / Discover feed via public AppView (app.bsky.feed.getFeed)
 *  4. Trending topics via public AppView (app.bsky.unspecced.getTrendingTopics)
 *  5. Popular custom feed generators (app.bsky.unspecced.getPopularFeedGenerators)
 *  6. Curated crypto actors (app.bsky.feed.getAuthorFeed)
 *  7. Search fallback (app.bsky.feed.searchPosts) — may be rate-limited by CDN
 *
 * Rate Limit: 3000 requests/5 minutes (public API - app.bsky.app)
 * Rate Limit: self-hosted PDS is local, effectively unlimited
 */

import { BoundedCache } from '../../lib/bounded-cache';
import { filterFreshPosts } from '../../lib/freshness';
import { checkRateLimit } from '../../rate-limiter';
import type { UnifiedPost } from '../../server';
import { getFirehosePosts, startFirehose } from './firehose';
import { postToUnified } from './mapper';
import type { BskyFeedResponse, BskyPostView } from './types';

const $fetch = globalThis.fetch;

const PDS_BASE = 'http://127.0.0.1:3012';
const BSKY_PUBLIC = 'https://public.api.bsky.app';

// ─── Profile avatar cache ─────────────────────────────────────────────
// PDS-repo and firehose posts arrive with a minimal author (did + handle,
// no avatar). Resolving the avatar requires an app.bsky.actor.getProfile
// call per DID, so we cache results (30 min TTL) to keep the fan-out cheap
// while still surfacing real avatars on those posts.

const AVATAR_CACHE_TTL_MS = 30 * 60 * 1000;
// Bounded: entry cap + TTL sweep (the old Map never evicted stale DIDs).
const avatarCache = new BoundedCache<string>({
  maxEntries: 5_000,
  ttlMs: AVATAR_CACHE_TTL_MS,
  sweepIntervalMs: 5 * 60 * 1000,
});

/** Resolve an author's avatar URL from the public AppView (cached). */
export async function getAvatarForDid(did: string): Promise<string> {
  if (!did) return '';
  const cached = avatarCache.get(did);
  if (cached !== undefined) return cached;
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!res || !res.ok) return '';
    const data = (await res.json()) as { avatar?: string };
    const avatar = data.avatar || '';
    avatarCache.set(did, avatar);
    return avatar;
  } catch {
    return '';
  }
}

/** Enrich an array of posts whose authors came from non-hydrated sources. */
export async function enrichMissingAvatars(posts: UnifiedPost[]): Promise<UnifiedPost[]> {
  if (posts.length === 0) return posts;
  const missing = posts.filter(
    (p) => !p.author.avatarUrl && p.author.primary?.protocol === 'bluesky',
  );
  if (missing.length === 0) return posts;
  const results = await Promise.allSettled(
    missing.map((p) =>
      getAvatarForDid(p.author.primary?.id || p.author.id.replace(/^bluesky:/, '')),
    ),
  );
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) missing[i]!.author.avatarUrl = r.value;
  });
  return posts;
}

// ─── Feed generator URIs (resolved 2026-08-03) ───────────────────────
const WHATS_HOT_FEED = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
const WITH_FRIENDS_FEED =
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends';
const TRENDING_GENERATOR_DID = 'did:plc:qrz3lhbyuxbeilrc6nekdqme'; // trending.bsky.app

// Popular custom feeds (from getPopularFeedGenerators, verified live)
const CUSTOM_FEEDS = [
  'at://did:plc:3guzzweuqraryl3rdkimjamk/app.bsky.feed.generator/for-you',
  'at://did:plc:tenurhgjptubkk5zf5qhi3og/app.bsky.feed.generator/mutuals',
  'at://did:plc:kkf4naxqmweop7dv4l2iqqf5/app.bsky.feed.generator/verified-news',
  'at://did:plc:y7crv2yh74s7qhmtx3mvbgv5/app.bsky.feed.generator/art-new',
  // Additional popular feed generators (verified via getPopularFeedGenerators
  // 2026-08-04) — broadens topical diversity beyond crypto into science,
  // gaming, astronomy and general interest.
  'at://did:plc:jfhpnnst6flqway4eaeqzj2a/app.bsky.feed.generator/for-science',
  'at://did:plc:w4xbfzo7kqfes5zb7r6qv3rw/app.bsky.feed.generator/blacksky',
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/hot-classic',
  'at://did:plc:4jrld6fwpnwqehtce56qshzv/app.bsky.feed.generator/game-dev',
  'at://did:plc:jcoy7v3a2t4rcfdh6i4kza25/app.bsky.feed.generator/astro',
];

// Crypto-relevant feed generator subscriptions (2026-08-05). These are the
// protocol-level "crypto" and "what's-crypto" feed generators; they are
// fetched alongside the general custom feeds so the Bluesky surface always
// carries on-niche content.
const CRYPTO_FEEDS = [
  'at://did:plc:z72i7hdynmk6r22z27z2q6yo/app.bsky.feed.generator/crypto',
  'at://did:plc:q6gjnaw2blty4crtr3nm2f6o/app.bsky.feed.generator/whats-crypto',
  // "Bitcoin & Crypto" style topical feeds (resolved via
  // getPopularFeedGenerators 2026-08-31)
  'at://did:plc:tenurhgjptubkk5zf5qhi3og/app.bsky.feed.generator/h-bitcoin',
  'at://did:plc:3awqkacz33aitph7ojbzv24l/app.bsky.feed.generator/aaacg5mlmmibi',
];

// AI / tech topical feeds (resolved via getPopularFeedGenerators 2026-08-31)
const AI_FEEDS = [
  'at://did:plc:rwvx7nvhwavvyi75m43lup6z/app.bsky.feed.generator/criticalai',
  'at://did:plc:yb37rlld5hddptt5dfywfgpz/app.bsky.feed.generator/aaaaauafsopbm',
];

const CURATED_ACTORS = [
  'naval.bsky.social',
  'pmarca.bsky.social',
  'solana.com',
  'tier10k.bsky.social',
  'jack.bsky.social',
  'wiillowthecat.bsky.social',
  'vitalik.eth.xyz',
  'balajis.com',
  'a16z.com',
  'coinbase.com',
  'karbonbased.bsky.social',
  'crypto_birb.bsky.social',
  // Additional curated actors (handles verified via resolveHandle
  // 2026-08-04) — crypto, tech, media and AI voices for a wider mix.
  'saylor.bsky.social',
  'brian.bsky.social',
  'paulg.bsky.social',
  'elon.bsky.social',
  'jessepollak.bsky.social',
  'shaw.bsky.social',
  'alexblania.bsky.social',
  'bankless.bsky.social',
  'thedefiant.bsky.social',
  'cointelegraph.bsky.social',
];
const SEARCH_QUERIES = [
  'bitcoin OR btc',
  'ethereum OR eth',
  'solana',
  'crypto',
  'defi',
  'ai',
  'web3',
];
const TRENDING_QUERY = 'crypto OR bitcoin OR ethereum OR solana OR defi';

/** Extract a blob CID from various AT Protocol ref formats */
function extractBlobCid(blob: unknown): string {
  if (!blob || typeof blob !== 'object') return '';
  const b = blob as Record<string, unknown>;
  const ref = b.ref;
  if (ref && typeof ref === 'object') {
    const r = ref as Record<string, unknown>;
    if (typeof r.$link === 'string') return r.$link;
    if (typeof r.link === 'string') return r.link;
    if (typeof r['/'] === 'string') return r['/'];
  }
  if (typeof b.$link === 'string') return b.$link;
  if (typeof b.link === 'string') return b.link;
  if (typeof b.cid === 'string') return b.cid;
  return '';
}

// ─── Session cache (authenticated PDS access) ─────────────────────────

let cachedAccessJwt: string | null = null;
let cachedJwtExpiresAt = 0;

async function getPdsSession(): Promise<string | null> {
  if (cachedAccessJwt && Date.now() < cachedJwtExpiresAt) return cachedAccessJwt;
  const identifier = process.env.BLUESKY_IDENTIFIER || '';
  const appPassword = process.env.BLUESKY_APP_PASSWORD || '';
  if (!identifier || !appPassword) return null;
  try {
    const res = await $fetch(`${PDS_BASE}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: appPassword }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessJwt?: string; expiresInSec?: number };
    if (!data.accessJwt) return null;
    cachedAccessJwt = data.accessJwt;
    cachedJwtExpiresAt = Date.now() + (data.expiresInSec || 600) * 1000 - 60_000;
    return cachedAccessJwt;
  } catch {
    return null;
  }
}

async function fetchFromPds(limit: number): Promise<UnifiedPost[]> {
  try {
    // Step 1: List all repos on the local PDS
    const listUrl = `${PDS_BASE}/xrpc/com.atproto.sync.listRepos?limit=30`;
    const listRes = await $fetch(listUrl, { signal: AbortSignal.timeout(5000) });
    if (!listRes.ok) {
      // console.log(`[bluesky] PDS listRepos: HTTP ${listRes.status}`);
      return [];
    }
    const listData = (await listRes.json()) as {
      repos?: Array<{ did: string; active?: boolean }>;
    };
    const repos = (listData.repos ?? []).filter((r) => r.active !== false);
    if (repos.length === 0) {
      // console.log('[bluesky] PDS: no repos found');
      return [];
    }
    // console.log(`[bluesky] PDS: ${repos.length} repos found`);

    // Step 2: Fetch posts from each repo (up to 15 repos, limit total)
    const perRepo = Math.max(1, Math.ceil(limit / Math.min(repos.length, 15)));
    const repoSlice = repos.slice(0, 15);

    const results = await Promise.allSettled(
      repoSlice.map(async (repo) => {
        // 2a. Resolve handle for this DID
        let handle: string = repo.did;
        try {
          const descUrl = `${PDS_BASE}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(repo.did)}`;
          const descRes = await $fetch(descUrl, {
            signal: AbortSignal.timeout(3000),
          });
          if (descRes.ok) {
            const descData = (await descRes.json()) as { handle?: string };
            if (descData.handle) handle = descData.handle;
          }
        } catch {
          // fall back to DID as handle
        }

        // 2b. Fetch posts for this repo
        const recordsUrl = `${PDS_BASE}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(repo.did)}&collection=app.bsky.feed.post&limit=${Math.min(perRepo, 100)}`;
        const recordsRes = await $fetch(recordsUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (!recordsRes.ok) return [] as UnifiedPost[];
        const recordsData = (await recordsRes.json()) as {
          records?: Array<{
            uri: string;
            cid: string;
            value: {
              text?: string;
              createdAt?: string;
              embed?: Record<string, unknown>;
              reply?: { parent: { uri: string }; root: { uri: string } };
              $type?: string;
              facets?: unknown[];
            };
          }>;
        };
        const records = (recordsData.records ?? []).filter((r) => r.value?.text?.trim());
        if (records.length === 0) return [] as UnifiedPost[];

        // 2c. Transform raw records into BskyPostView-compatible objects
        return records.map((record) => {
          const rawEmbed = record.value.embed;
          let embedImages:
            | Array<{
                image: { ref: { link: string } };
                alt: string;
                aspectRatio?: { width: number; height: number };
              }>
            | undefined;
          let embedExternal: { uri: string; title?: string; description?: string } | undefined;

          if (rawEmbed && typeof rawEmbed === 'object') {
            const e = rawEmbed as Record<string, unknown>;
            const images = e.images;
            if (Array.isArray(images)) {
              embedImages = images.map((img: Record<string, unknown>) => ({
                image: {
                  ref: {
                    link: extractBlobCid(img.image),
                  },
                },
                alt: (img.alt as string) || '',
                aspectRatio: img.aspectRatio as { width: number; height: number } | undefined,
              }));
            }
            const external = e.external;
            if (external && typeof external === 'object') {
              embedExternal = external as {
                uri: string;
                title?: string;
                description?: string;
              };
            }
          }

          // Build a minimal BskyPostView-compatible object
          const postView: BskyPostView = {
            uri: record.uri,
            cid: record.cid,
            author: {
              did: repo.did,
              handle,
              displayName: handle,
            },
            record: {
              text: record.value.text || '',
              createdAt: record.value.createdAt || new Date().toISOString(),
              facets: (record.value.facets as BskyPostView['record']['facets']) || undefined,
              embed:
                embedImages || embedExternal
                  ? {
                      external: embedExternal,
                      images: embedImages,
                    }
                  : undefined,
              reply: record.value.reply,
            },
            likeCount: 0,
            repostCount: 0,
            replyCount: 0,
            indexedAt: record.value.createdAt || new Date().toISOString(),
          };

          return postToUnified(postView);
        });
      }),
    );

    const allPosts: UnifiedPost[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allPosts.push(...r.value);
    }

    // console.log(`[bluesky] PDS: ${allPosts.length} posts from local PDS`);
    return allPosts.slice(0, limit);
  } catch {
    // console.log(`[bluesky] PDS error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchAuthorFeed(actor: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=${Math.min(limit, 100)}`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!res || !res.ok) return [];
    const data = (await res.json()) as BskyFeedResponse;
    return (
      data.feed
        ?.map((f) => f.post)
        .filter(Boolean)
        .slice(0, limit)
        .map(postToUnified) ?? []
    );
  } catch {
    return [];
  }
}

async function searchPosts(query: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 100)}&sort=latest`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // console.log(`[bluesky] searchPosts(${query}): HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as BskyFeedResponse;
    return data.posts?.slice(0, limit).map(postToUnified) ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch a hydrated feed by generator URI (app.bsky.feed.getFeed).
 * This is the primary AT Protocol content surface — What's Hot, custom
 * feeds, and trending topic feeds all route through it.
 */
async function fetchFeedByUri(
  feedUri: string,
  limit: number,
  authJwt?: string,
): Promise<UnifiedPost[]> {
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(feedUri)}&limit=${Math.min(limit, 100)}`;
    const res = await $fetch(url, {
      headers: {
        'User-Agent': 'DegenFeed-Bridge/0.1',
        ...(authJwt ? { Authorization: `Bearer ${authJwt}` } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // console.log(`[bluesky] getFeed(${feedUri.split('/').pop()}): HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as BskyFeedResponse;
    return (
      data.feed
        ?.map((f) => f.post)
        .filter(Boolean)
        .slice(0, limit)
        .map(postToUnified) ?? []
    );
  } catch {
    return [];
  }
}

/** Fetch the authenticated home timeline via our PDS (Popular with Friends equivalent). */
async function fetchHomeTimeline(limit: number): Promise<UnifiedPost[]> {
  const jwt = await getPdsSession();
  if (!jwt) return [];
  try {
    const url = `${PDS_BASE}/xrpc/app.bsky.feed.getTimeline?limit=${Math.min(limit, 100)}`;
    const res = await $fetch(url, {
      headers: { Authorization: `Bearer ${jwt}`, 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as BskyFeedResponse;
    return (
      data.feed
        ?.map((f) => f.post)
        .filter(Boolean)
        .map(postToUnified) ?? []
    );
  } catch {
    return [];
  }
}

/** Fetch "Popular with Friends" feed via authenticated session. */
async function fetchWithFriends(limit: number): Promise<UnifiedPost[]> {
  const jwt = await getPdsSession();
  if (!jwt) return [];
  try {
    const url = `${PDS_BASE}/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(WITH_FRIENDS_FEED)}&limit=${Math.min(limit, 100)}`;
    const res = await $fetch(url, {
      headers: { Authorization: `Bearer ${jwt}`, 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as BskyFeedResponse;
    return (
      data.feed
        ?.map((f) => f.post)
        .filter(Boolean)
        .map(postToUnified) ?? []
    );
  } catch {
    return [];
  }
}

/** Fetch trending topics and map them to trending.bsky.app feed URIs. */
async function fetchTrendingTopics(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${BSKY_PUBLIC}/xrpc/app.bsky.unspecced.getTrendingTopics?limit=8`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // console.log(`[bluesky] getTrendingTopics: HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      topics?: Array<{ topic: string; link?: string }>;
    };
    const links = (data.topics ?? [])
      .map((t) => t.link)
      .filter((l): l is string => !!l)
      .map((l) => {
        // "/profile/trending.bsky.app/feed/817966476" → feed URI
        const m = /\/feed\/([^/]+)$/.exec(l);
        if (!m?.[1]) return null;
        return `at://${TRENDING_GENERATOR_DID}/app.bsky.feed.generator/${m[1]}`;
      })
      .filter((l): l is string => !!l)
      .slice(0, 4);

    const all: UnifiedPost[] = [];
    const perFeed = Math.max(3, Math.ceil(limit / Math.max(links.length, 1)));
    const results = await Promise.allSettled(
      links.map((feedUri) => fetchFeedByUri(feedUri, perFeed)),
    );
    for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
    // console.log(`[bluesky] Trending topics: ${all.length} posts`);
    return all.slice(0, limit);
  } catch {
    return [];
  }
}

function dedupe(posts: UnifiedPost[], limit: number): UnifiedPost[] {
  const seen = new Set<string>();
  return posts
    .filter((p) => {
      const k = p.text.slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}

export async function fetchBlueskyImageFeed(limit = 30): Promise<UnifiedPost[]> {
  const all = await fetchAllCuratedPosts(Math.ceil(limit * 2));
  if (all.filter((p) => p.embeds.some((e) => e.kind === 'image')).length < limit) {
    const results = await Promise.allSettled(
      ['crypto crypto', 'bitcoin chart', 'nft art'].map((q) =>
        searchPosts(q, Math.ceil(limit / 2)),
      ),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
  }
  const filtered = all.filter((p) => p.embeds.some((e) => e.kind === 'image'));
  const deduped = dedupe(filtered, limit);
  // console.log(`[bridge] Bluesky Image Feed: ${deduped.length} posts`);
  return deduped;
}

export async function fetchBlueskyVideoFeed(limit = 20): Promise<UnifiedPost[]> {
  const all = await fetchAllCuratedPosts(Math.ceil(limit * 2));
  const filtered = all.filter((p) => p.embeds.some((e) => e.kind === 'link' || e.kind === 'video'));
  const deduped = dedupe(filtered, limit);
  // console.log(`[bridge] Bluesky Video Feed: ${deduped.length} posts`);
  return deduped;
}

export async function fetchBlueskyTrending(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];
  const trending = await searchPosts(TRENDING_QUERY, Math.ceil(limit * 1.5));
  all.push(...trending);
  if (all.length < limit / 2) {
    const curated = await fetchAllCuratedPosts(Math.ceil(limit / 2));
    all.push(...curated);
  }
  const deduped = dedupe(all, limit);
  // console.log(`[bridge] Bluesky Trending: ${deduped.length} posts`);
  return deduped;
}

async function fetchAllCuratedPosts(limit: number): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];
  // Cover the expanded curated actor list (bounded for latency).
  const actorsToFetch = CURATED_ACTORS.slice(0, 12);
  const perActor = Math.max(3, Math.ceil(limit / actorsToFetch.length));
  const results = await Promise.allSettled(actorsToFetch.map((a) => fetchAuthorFeed(a, perActor)));
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  return dedupe(all, limit);
}

export async function fetchBlueskyPosts(limit = 20): Promise<UnifiedPost[]> {
  // Rate limit: 3000 requests/5 minutes (public API)
  if (!checkRateLimit('bluesky', { maxRequests: 3000, windowMs: 300_000 })) {
    // console.log('[bluesky] Rate limited, skipping fetch');
    return [];
  }

  // Real-time firehose posts (Jetstream — no API rate cost)
  startFirehose();
  const firehosePosts = getFirehosePosts(Math.max(2, Math.ceil(limit / 6)));

  // Per-source budget: every source gets a full share (50+ at limit=50) so
  // the merged pool is deep enough to survive freshness + dedupe trimming.
  const perSource = Math.max(50, limit);

  // All independent sources run CONCURRENTLY — the bridge provider timeout
  // is 12s and a sequential fan-out across ~20 upstream calls blows it.
  const [
    timelineRes,
    withFriendsRes,
    whatsHotRes,
    customRes,
    cryptoRes,
    aiRes,
    trendingRes,
    pdsRes,
    curatedRes,
  ] = await Promise.allSettled([
    fetchHomeTimeline(perSource),
    fetchWithFriends(perSource),
    fetchFeedByUri(WHATS_HOT_FEED, perSource),
    Promise.allSettled(CUSTOM_FEEDS.map((f) => fetchFeedByUri(f, perSource))),
    Promise.allSettled(CRYPTO_FEEDS.map((f) => fetchFeedByUri(f, perSource))),
    Promise.allSettled(AI_FEEDS.map((f) => fetchFeedByUri(f, perSource))),
    fetchTrendingTopics(perSource),
    fetchFromPds(Math.max(2, Math.ceil(limit / 6))),
    fetchAllCuratedPosts(Math.ceil(limit / 2)),
  ]);

  const all: UnifiedPost[] = [...firehosePosts];
  const collect = (r: PromiseSettledResult<UnifiedPost[]>) => {
    if (r.status === 'fulfilled') all.push(...r.value);
  };
  collect(timelineRes);
  collect(withFriendsRes);
  collect(whatsHotRes);
  if (customRes.status === 'fulfilled') {
    for (const r of customRes.value) collect(r);
  }
  if (cryptoRes.status === 'fulfilled') {
    for (const r of cryptoRes.value) collect(r);
  }
  if (aiRes.status === 'fulfilled') {
    for (const r of aiRes.value) collect(r);
  }
  collect(trendingRes);
  collect(pdsRes);
  collect(curatedRes);

  // Search fallback — only if the parallel fan-out still came up short
  if (all.length < limit / 2) {
    const searchResults = await Promise.allSettled(
      SEARCH_QUERIES.slice(0, 4).map((q) => searchPosts(q, Math.max(3, Math.ceil(limit / 4)))),
    );
    for (const r of searchResults) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
  }

  // Freshness: discard posts outside the FEED_MAX_AGE_HOURS window (48h)
  // BEFORE dedup so the cap fills with fresh content only.
  const fresh = filterFreshPosts(all);
  const deduped = dedupe(fresh, limit);
  //   console.log(
  //     `[bridge] Bluesky: ${deduped.length} posts (firehose: ${firehosePosts.length}, timeline: ${timeline.length}, whats-hot: ${whatsHot.length}, pds: ${pdsPosts.length})`,
  //   );
  return deduped;
}

export const schema = {
  id: 'bluesky',
  name: 'Bluesky/AT Protocol',
  description:
    "AT Protocol social network — What's Hot, custom feeds, trending topics, PDS federation, firehose",
  endpoint: '/api/feed/bluesky',
  requiresAuth: false,
  contentType: 'mixed',
};
export const fetch = fetchBlueskyPosts;
