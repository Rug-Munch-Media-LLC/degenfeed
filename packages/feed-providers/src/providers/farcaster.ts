/**
 * FarcasterProvider — Fetches casts from Farcaster hubs.
 *
 * Strategy (in order):
 *   1. Popular channels: /crypto, /dev, /founders, /design, /memes via
 *      hub `castsByParent` (channel URL) — real, trending community content
 *   2. Curated FIDs via `castsByFid` — consistently posting crypto/web3
 *   3. Public Farcaster API: api.farcaster.xyz v2/casts for trending voices
 *
 * All sources fan out across MULTIPLE hubs in parallel (Pinata,
 * StandardCrypto, Neynar, plus the local Hubble when reachable) so a
 * single hub outage never empties the feed.
 */

import {
  buildUnifiedPost,
  CircuitBreaker,
  CircuitBreakerError,
  enrichPostNiches,
} from '@degenfeed/feed-core';
import type { Embed, MediaAttachment, Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

export const DEFAULT_HUB_URL = 'http://127.0.0.1:2281';
export const FALLBACK_HUB_URLS = [
  'https://hubble.degenfeed.xyz',
  'https://hub.farcaster.standardcrypto.vc:2281',
  'https://hub.pinata.cloud',
  'https://hub-grpc.pinata.cloud',
];

export const DEFAULT_FARCASTER_PUBLIC_API = 'https://api.farcaster.xyz';

export const CURATED_FARCASTER_FIDS = [
  3, 2, 1, 99, 100, 215, 320, 602, 1234, 4242, 5650, 2017, 415, 8662, 2209, 824,
];

/**
 * Popular Farcaster channels, fetched via hub `castsByParent` with the
 * channel's Warpcast URL as the parent. These are the highest-traffic
 * channels network-wide (2026-08-06), so their feeds approximate
 * trending casts without an API key.
 */
export const POPULAR_FARCASTER_CHANNELS = [
  'https://warpcast.com/~/channel/crypto',
  'https://warpcast.com/~/channel/dev',
  'https://warpcast.com/~/channel/founders',
  'https://warpcast.com/~/channel/design',
  'https://warpcast.com/~/channel/memes',
];

export interface FarcasterProviderOptions {
  hubUrl?: string;
  fallbackHubUrls?: string[];
  publicApiUrl?: string;
  curatedFids?: number[];
}

interface HubCastMessage {
  data: {
    timestamp: number;
    fid?: number;
    castAddBody?: {
      text?: string;
      embedsDeprecated?: Array<{ url?: string } | string>;
      embeds?: Array<{ url?: string } | string>;
      parentUrl?: string;
      parentCastId?: { fid: number; hash: string };
    };
  };
  hash: string;
}

/**
 * Resolved Farcaster user profile (from hub userDataByFid).
 */
export interface ResolvedFarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfp?: string;
  bio?: string;
}

const USER_DATA_CACHE_TTL_MS = 60_000;

/**
 * In-memory hub user-data cache: fid → resolved user.
 * Keyed globally so channel + FID + padding sources share lookups.
 */
const userDataCache = new Map<number, { resolved: ResolvedFarcasterUser; fetchedAt: number }>();

/** In-flight dedupe so concurrent channel fetches don't double-hit the hub. */
const userDataInflight = new Map<number, Promise<ResolvedFarcasterUser>>();

export function clearFarcasterUserDataCache(): void {
  userDataCache.clear();
  userDataInflight.clear();
}

/**
 * Resolve a Farcaster FID to a real user profile via the hub
 * `userDataByFid` endpoint. Never throws — returns `{ fid }` on failure so
 * callers fall back to a FID placeholder instead of dropping the post.
 */
export async function resolveFarcasterUser(
  hub: string,
  fid: number,
  timeoutMs: number,
): Promise<ResolvedFarcasterUser> {
  if (!fid) return { fid };
  const cached = userDataCache.get(fid);
  if (cached && Date.now() - cached.fetchedAt < USER_DATA_CACHE_TTL_MS) {
    return cached.resolved;
  }
  const inflight = userDataInflight.get(fid);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const data = await withTimeout(
        fetchJson<{
          messages?: Array<{ data: { userDataBody: { type: string; value: string } } }>;
        }>(buildUrl(hub, '/v1/userDataByFid', { fid: String(fid) }), {
          headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
        }),
        Math.min(timeoutMs, 3000),
        `farcaster:user:${fid}`,
      );
      const resolved: ResolvedFarcasterUser = { fid };
      for (const msg of data.messages ?? []) {
        const body = msg.data?.userDataBody;
        if (!body) continue;
        if (body.type === 'USER_DATA_TYPE_USERNAME') resolved.username = body.value;
        else if (body.type === 'USER_DATA_TYPE_DISPLAY') resolved.displayName = body.value;
        else if (body.type === 'USER_DATA_TYPE_PFP') resolved.pfp = body.value;
        else if (body.type === 'USER_DATA_TYPE_BIO') resolved.bio = body.value;
      }
      userDataCache.set(fid, { resolved, fetchedAt: Date.now() });
      return resolved;
    } catch {
      // Hub miss — cache the empty resolution so we don't hammer it.
      userDataCache.set(fid, { resolved: { fid }, fetchedAt: Date.now() });
      return { fid };
    }
  })();
  userDataInflight.set(fid, request);
  try {
    return await request;
  } finally {
    userDataInflight.delete(fid);
  }
}

/** Build a farcaster profile URL from a resolved user (or FID fallback). */
export function farcasterProfileUrl(user: ResolvedFarcasterUser): string {
  if (user.username) return `https://warpcast.com/${encodeURIComponent(user.username)}`;
  return `https://warpcast.com/~/profiles/${user.fid}`;
}

/**
 * Extract image/video/link media from a Farcaster cast body.
 *
 * Farcaster casts attach embeds as either `embedsDeprecated` (array of URL
 * strings on the hub API) or `embeds` (array of `{ url }` objects / strings
 * on the public API). Image casts (the dominant crypto media type) are
 * surfaced as media + image embeds; video URLs as video embeds; everything
 * else becomes a link embed.
 */
export function extractCastMedia(body: HubCastMessage['data']['castAddBody'] | undefined): {
  embeds: Embed[];
  media: MediaAttachment[];
} {
  const embeds: Embed[] = [];
  const media: MediaAttachment[] = [];
  if (!body) return { embeds, media };
  const rawUrls: string[] = [];
  for (const list of [body.embeds, body.embedsDeprecated]) {
    if (!Array.isArray(list)) continue;
    for (const e of list) {
      if (typeof e === 'string') rawUrls.push(e);
      else if (e && typeof e.url === 'string') rawUrls.push(e.url);
    }
  }
  const seen = new Set<string>();
  for (const url of rawUrls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    if (/\.(?:jpg|jpeg|png|gif|webp|avif)(?:\?|$)/i.test(url)) {
      embeds.push({ kind: 'image', url });
      media.push({ type: 'image', url });
    } else if (/\.(?:mp4|webm|mov|m4v)(?:\?|$)/i.test(url)) {
      embeds.push({ kind: 'video', url });
      media.push({ type: 'video', url });
    } else {
      embeds.push({ kind: 'link', url });
    }
  }
  return { embeds, media };
}

export class FarcasterProvider implements FeedProvider {
  readonly protocol: Protocol = 'farcaster';

  readonly schema: SchemaGuard = (): boolean => true;
  private readonly primaryUrl: string;
  private readonly publicApiUrl: string;
  private readonly curatedFids: number[];
  private readonly fallbackHubUrls: string[];
  private readonly breaker = new CircuitBreaker('farcaster');

  constructor(options: FarcasterProviderOptions = {}) {
    this.primaryUrl = options.hubUrl || DEFAULT_HUB_URL;
    this.publicApiUrl = options.publicApiUrl || DEFAULT_FARCASTER_PUBLIC_API;
    this.curatedFids = options.curatedFids ?? CURATED_FARCASTER_FIDS;
    this.fallbackHubUrls = options.fallbackHubUrls ?? FALLBACK_HUB_URLS;
  }

  /**
   * Resolve the first reachable hub at runtime.
   *
   * Probes the primary hub, then each configured fallback hub with a cheap
   * castsByFid request. Returns the first hub that responds; if every hub
   * fails, returns the primary URL so the caller's normal error handling
   * (empty posts + notice) applies.
   */
  private async resolveHub(timeoutMs: number): Promise<string> {
    const candidates = [this.primaryUrl, ...this.fallbackHubUrls];
    for (const url of candidates) {
      try {
        await withTimeout(
          fetchJson(buildUrl(url, '/v1/castsByFid', { fid: '3', pageSize: '1' })),
          Math.min(timeoutMs, 3000),
          `farcaster:hub-select:${new URL(url).hostname}`,
        );
        return url;
      } catch {
        // Try the next hub.
      }
    }
    return this.primaryUrl;
  }

  private async fetchCastsByFid(
    hub: string,
    fid: number,
    timeoutMs: number,
  ): Promise<UnifiedPost[]> {
    const [castData, userData] = await Promise.all([
      withTimeout(
        fetchJson<{ messages?: HubCastMessage[] }>(
          buildUrl(hub, '/v1/castsByFid', { fid: String(fid), pageSize: '15' }),
          { headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' } },
        ),
        Math.min(timeoutMs, 5000),
        `farcaster:fid:${fid}`,
      ),
      resolveFarcasterUser(hub, fid, timeoutMs),
    ]);

    const messages = castData.messages ?? [];

    // Fetch reaction counts for the top casts
    const reactionCounts = new Map<string, number>();
    await Promise.allSettled(
      messages.slice(0, 6).map(async (m) => {
        try {
          const reactions = await withTimeout(
            fetchJson<{ messages?: Array<{ data: { reactionBody?: { type: string } } }> }>(
              buildUrl(hub, '/v1/reactionsByCast', {
                hash: m.hash,
                reaction_type: '1', // like
                pageSize: '100',
              }),
              { headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' } },
            ),
            Math.min(timeoutMs, 3000),
            `farcaster:reactions:${m.hash.slice(0, 8)}`,
          );
          reactionCounts.set(m.hash, (reactions.messages ?? []).length);
        } catch {
          reactionCounts.set(m.hash, 0);
        }
      }),
    );

    const handle = userData.username ? `${userData.username}` : `fid:${fid}`;
    return messages.map((m) => {
      const ts = (m.data.timestamp + 1609459200) * 1000;
      const text = m.data.castAddBody?.text ?? '';
      const castMedia = extractCastMedia(m.data.castAddBody);
      return buildUnifiedPost({
        protocol: 'farcaster',
        nativeId: m.hash,
        author: {
          id: `farcaster:${fid}`,
          primary: { protocol: 'farcaster', id: String(fid) },
          handles: {
            nostr: null,
            farcaster: handle,
            lens: null,
            bluesky: null,
            threads: null,
            rss: null,
            mastodon: null,
          },
          displayName: userData.displayName || userData.username || `FID ${fid}`,
          bio: userData.bio ?? '',
          avatarUrl: userData.pfp || '',
          verified: [],
          followerCount: 0,
          followingCount: 0,
          links: [],
          url: farcasterProfileUrl(userData),
          keys: { fid },
        },
        text,
        createdAt: Number.isNaN(ts) ? Date.now() : ts,
        metrics: {
          likes: reactionCounts.get(m.hash) ?? 0,
          reposts: 0,
          replies: 0,
          quotes: 0,
        },
        raw: m,
        embeds: castMedia.embeds,
        media: castMedia.media,
      });
    });
  }

  private async fetchChannelCasts(
    hub: string,
    channelUrl: string,
    timeoutMs: number,
  ): Promise<UnifiedPost[]> {
    const data = await withTimeout(
      fetchJson<{ messages?: HubCastMessage[] }>(
        buildUrl(hub, '/v1/castsByParent', { url: channelUrl, pageSize: '25' }),
        { headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' } },
      ),
      Math.min(timeoutMs, 5000),
      `farcaster:channel:${channelUrl.split('/').pop()}`,
    );
    const messages = data.messages ?? [];

    // Fetch reaction counts for the top casts in each channel
    const reactionCounts = new Map<string, number>();
    await Promise.allSettled(
      messages.slice(0, 8).map(async (m) => {
        try {
          const reactions = await withTimeout(
            fetchJson<{ messages?: Array<{ data: { reactionBody?: { type: string } } }> }>(
              buildUrl(hub, '/v1/reactionsByCast', {
                hash: m.hash,
                reaction_type: '1', // like
                pageSize: '100',
              }),
              { headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' } },
            ),
            Math.min(timeoutMs, 3000),
            `farcaster:chreactions:${m.hash.slice(0, 8)}`,
          );
          reactionCounts.set(m.hash, (reactions.messages ?? []).length);
        } catch {
          reactionCounts.set(m.hash, 0);
        }
      }),
    );

    // Resolve real author profiles for the casts' FIDs. The hub channel
    // response only carries `data.fid`, so without this lookup every
    // channel post would render as a nameless "FID NNNN" placeholder.
    // Lookups are cached + in-flight deduped and concurrency-limited so
    // the 5-channel fan-out never hammers the hub.
    const channelName = channelUrl.split('/').pop() ?? 'channel';
    const fidOf = (m: HubCastMessage): number => m.data.fid ?? 0;
    const uniqueFids = Array.from(new Set(messages.map(fidOf).filter((f) => f > 0)));
    const userByFid = new Map<number, ResolvedFarcasterUser>();
    if (uniqueFids.length > 0) {
      const resolved = await withConcurrencyLimit(
        uniqueFids,
        10,
        (fid) => resolveFarcasterUser(hub, fid, timeoutMs),
      );
      for (const user of resolved) userByFid.set(user.fid, user);
    }

    return messages.map((m) => {
      const fid = fidOf(m);
      const user = userByFid.get(fid) ?? { fid };
      const ts = (m.data.timestamp + 1609459200) * 1000;
      const text = m.data.castAddBody?.text ?? '';
      const castMedia = extractCastMedia(m.data.castAddBody);
      return buildUnifiedPost({
        protocol: 'farcaster',
        nativeId: m.hash,
        author: {
          id: `farcaster:${fid}`,
          primary: { protocol: 'farcaster', id: String(fid) },
          handles: {
            nostr: null,
            farcaster: user.username ?? null,
            lens: null,
            bluesky: null,
            threads: null,
            rss: null,
            mastodon: null,
          },
          displayName: user.displayName || user.username || `FID ${fid}`,
          bio: user.bio ?? '',
          avatarUrl: user.pfp || '',
          verified: [],
          followerCount: 0,
          followingCount: 0,
          links: [],
          url: farcasterProfileUrl(user),
          keys: { fid },
        },
        text,
        createdAt: Number.isNaN(ts) ? Date.now() : ts,
        metrics: {
          likes: reactionCounts.get(m.hash) ?? 0,
          reposts: 0,
          replies: 0,
          quotes: 0,
        },
        raw: { ...m, _channel: channelName },
        embeds: castMedia.embeds,
        media: castMedia.media,
      });
    });
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const hub = await this.resolveHub(timeoutMs);
        // Use all reachable fallback hubs in parallel for fan-out.
        const hubPool = [hub, ...this.fallbackHubUrls.filter((u) => u !== hub)].slice(0, 4);
        const all: UnifiedPost[] = [];

        // ── Source 1: Popular channels (trending community content) ──
        // Fan channels across hubs in parallel. Each channel yields up to
        // 25 casts, and we fetch all 5 channels = up to 125 channel casts.
        const channelResults = await withConcurrencyLimit(
          POPULAR_FARCASTER_CHANNELS.map((channelUrl, i) => ({
            channelUrl,
            hubUrl: hubPool[i % hubPool.length] ?? hub,
          })),
          5,
          async ({ channelUrl, hubUrl }) => {
            try {
              return await this.fetchChannelCasts(hubUrl, channelUrl, timeoutMs);
            } catch {
              // Retry on the primary hub
              try {
                return await this.fetchChannelCasts(hub, channelUrl, timeoutMs);
              } catch {
                return [] as UnifiedPost[];
              }
            }
          },
        );
        for (const r of channelResults) all.push(...r);

        // ── Source 2: Curated FIDs — fan across hubs in parallel ──
        const fidResults = await withConcurrencyLimit(
          this.curatedFids.map((fid, i) => ({
            fid,
            hubUrl: hubPool[i % hubPool.length] ?? hub,
          })),
          8,
          async ({ fid, hubUrl }) => {
            try {
              return await this.fetchCastsByFid(hubUrl, fid, timeoutMs);
            } catch {
              try {
                return await this.fetchCastsByFid(hub, fid, timeoutMs);
              } catch {
                return [] as UnifiedPost[];
              }
            }
          },
        );
        for (const r of fidResults) all.push(...r);

        // ── Source 3: Trending search via public API (best-effort) ──
        const searchResults: UnifiedPost[] = [];
        try {
          const searchData = await withTimeout(
            fetchJson<{
              result?: {
                casts?: Array<{
                  hash: string;
                  fid?: number;
                  text?: string;
                  timestamp?: number;
                  embeds?: Array<{ url?: string } | string>;
                  author?: {
                    fid?: number;
                    username?: string;
                    displayName?: string;
                    pfp?: { url?: string };
                  };
                }>;
              };
            }>(buildUrl(this.publicApiUrl, '/v2/casts', { fid: '3', limit: '10' }), {
              headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
            }),
            Math.min(timeoutMs, 5000),
            'farcaster:search',
          );
          for (const c of searchData?.result?.casts ?? []) {
            const fid = c.fid ?? c.author?.fid;
            const text = c.text;
            if (!fid || !text || !c.hash) continue;
            const castMedia = extractCastMedia({
              embeds: c.embeds as Array<{ url?: string } | string> | undefined,
            } as HubCastMessage['data']['castAddBody']);
            searchResults.push(
              buildUnifiedPost({
                protocol: 'farcaster',
                nativeId: c.hash,
                author: {
                  id: `farcaster:${fid}`,
                  primary: { protocol: 'farcaster', id: String(fid) },
                  handles: {
                    nostr: null,
                    farcaster: c.author?.username ?? null,
                    lens: null,
                    bluesky: null,
                    threads: null,
                    rss: null,
                    mastodon: null,
                  },
                  displayName: c.author?.displayName || c.author?.username || `FID ${fid}`,
                  bio: '',
                  avatarUrl: c.author?.pfp?.url || '',
                  verified: [],
                  followerCount: 0,
                  followingCount: 0,
                  links: [],
                  url: c.author?.username
                    ? `https://warpcast.com/${encodeURIComponent(c.author.username)}`
                    : `https://warpcast.com/~/profiles/${fid}`,
                  keys: { fid },
                },
                text,
                createdAt: c.timestamp ? c.timestamp * 1000 : Date.now(),
                metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
                raw: c,
                embeds: castMedia.embeds,
                media: castMedia.media,
              }),
            );
          }
        } catch {
          /* search unavailable */
        }
        all.push(...searchResults);

        // ── Deduplicate by hash, then sort newest-first ──
        const seen = new Set<string>();
        const unique = all.filter((p) => {
          const key = p.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Golden rule: never return less than 50 posts. If the merged
        // sources produced fewer, fall back to a broad recentCasts sweep
        // across hubs to pad the feed.
        let finalPosts = unique;
        if (unique.length < 50) {
          const padding: UnifiedPost[] = [];
          const padResults = await withConcurrencyLimit(
            hubPool,
            4,
            async (hubUrl) => {
              try {
                const data = await withTimeout(
                  fetchJson<{ messages?: HubCastMessage[] }>(
                    buildUrl(hubUrl, '/v1/castsByFid', { fid: '2', pageSize: '50' }),
                    { headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' } },
                  ),
                  Math.min(timeoutMs, 5000),
                  `farcaster:pad:${new URL(hubUrl).hostname}`,
                );
                const fid = 2;
                // Resolve real author profile for the padding FID so even
                // the fallback sweep never renders a nameless placeholder.
                const user = await resolveFarcasterUser(hubUrl, fid, timeoutMs);
                return (data.messages ?? []).map((m) => {
                  const ts = (m.data.timestamp + 1609459200) * 1000;
                  const castMedia = extractCastMedia(m.data.castAddBody);
                  return buildUnifiedPost({
                    protocol: 'farcaster',
                    nativeId: m.hash,
                    author: {
                      id: `farcaster:${fid}`,
                      primary: { protocol: 'farcaster', id: String(fid) },
                      handles: {
                        nostr: null,
                        farcaster: user.username ?? null,
                        lens: null,
                        bluesky: null,
                        threads: null,
                        rss: null,
                        mastodon: null,
                      },
                      displayName: user.displayName || user.username || `FID ${fid}`,
                      bio: user.bio ?? '',
                      avatarUrl: user.pfp || '',
                      verified: [],
                      followerCount: 0,
                      followingCount: 0,
                      links: [],
                      url: farcasterProfileUrl(user),
                      keys: { fid },
                    },
                    text: m.data.castAddBody?.text ?? '',
                    createdAt: Number.isNaN(ts) ? Date.now() : ts,
                    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
                    raw: m,
                    embeds: castMedia.embeds,
                    media: castMedia.media,
                  });
                });
              } catch {
                return [] as UnifiedPost[];
              }
            },
          );
          for (const r of padResults) padding.push(...r);
          const seenPad = new Set<string>(unique.map((p) => p.id));
          const padUnique = padding.filter((p) => {
            const key = p.id;
            if (seenPad.has(key)) return false;
            seenPad.add(key);
            return true;
          });
          finalPosts = [...unique, ...padUnique];
        }

        const merged = [...finalPosts].sort((a, b) => b.createdAt - a.createdAt);
        return merged.length
          ? { posts: merged.map(enrichPostNiches) }
          : { posts: [], notice: 'Farcaster unavailable' };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Farcaster: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Farcaster unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Probe multiple hubs in parallel — only one needs to respond.
    const hubUrls = [this.primaryUrl, ...this.fallbackHubUrls.slice(0, 3)];
    const probe = async (url: string): Promise<boolean> => {
      try {
        await withTimeout(
          fetchJson(buildUrl(url, '/v1/castsByFid', { fid: '3', pageSize: '1' })),
          Math.min(timeoutMs, 4000),
          `farcaster:health:${new URL(url).hostname}`,
        );
        return true;
      } catch {
        return false;
      }
    };

    const results = await Promise.allSettled(hubUrls.map(probe));
    const anyHealthy = results.some((r) => r.status === 'fulfilled' && r.value);

    return {
      healthy: anyHealthy,
      latencyMs: Math.round(performance.now() - start),
      error: anyHealthy ? undefined : 'All Farcaster hubs unreachable',
    };
  }
}
