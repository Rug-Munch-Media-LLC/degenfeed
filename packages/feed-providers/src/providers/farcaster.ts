/**
 * FarcasterProvider — Fetches casts from Farcaster hubs with free API fallbacks.
 *
 * Strategy (in order):
 *   1. Hub: fetch casts from a curated set of real crypto FIDs via the hub
 *   2. Username resolution: resolve usernames to FIDs via /v1/userNameProofByName
 *   3. Free public API fallback: Neynar-compatible search at api.farcaster.xyz
 *      (no auth required for basic reads, returns recent casts matching keywords)
 *
 * The curated FIDs below are real Farcaster accounts that consistently
 * post crypto/web3 content.
 */

import { detectNiches, enrichPostNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  fetchWithFallbacks,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

export const DEFAULT_HUB_URL = 'https://hub.pinata.cloud';
export const FALLBACK_HUB_URLS = [
  'https://hoyt.farcaster.standardcrypto.vc:2281',
  'https://hub-grpc.pinata.cloud',
  'https://hub.pinata.cloud',
  'https://nemes.farcaster.xyz',
];

export const DEFAULT_FARCASTER_PUBLIC_API = 'https://api.farcaster.xyz';

export const CURATED_FARCASTER_FIDS = [3, 2, 1, 99, 100, 215, 320, 602, 1234, 4242];

export const CURATED_FARCASTER_USERNAMES = [
  'vitalik.eth',
  'dwr.eth',
  'jessepollak',
  'balajis',
  'pmarca',
  'naval',
  'sama',
  'twobitidiot',
  'cdixon.eth',
  'danromero',
  'jessewldn',
  'tonytradz',
  'cryptoyieldinfo',
  'defiprime',
  'coopahtroopa',
  'rleshner',
  'stani',
  'aaboronin',
  'hosseeb',
  'sassal0x',
  '0xfoobar',
  'kermankohli',
  '0x_bentley',
  'mikedemarais',
  'bountykinds',
  'brycent',
  'ted',
  'bendi',
  'gavi',
  'saori',
  'rambles',
  'midena',
  'tushar',
  'dom',
  'nibnalin',
  'steven',
  'calaxy',
  'jessica',
  'yuga',
  'farcaster',
  'warpcast',
  'kurt',
];

export const CRYPTO_SEARCH_TERMS = [
  'bitcoin',
  'ethereum',
  'crypto',
  'defi',
  'web3',
  'solana',
  'nft',
  'blockchain',
  'btc',
  'eth',
];

interface HubCastMessage {
  data: {
    castAddBody: {
      text: string;
      embeds: { url?: string }[];
      parentCastId?: { hash: string; fid: number };
      parentUrl?: string;
    };
    timestamp: number;
  };
  hash: string;
}

interface HubCastResponse {
  messages?: HubCastMessage[];
}

interface HubUserDataBody {
  type: string;
  value: string;
}

interface HubUserDataMessage {
  data: {
    fid: number;
    userDataBody: HubUserDataBody;
  };
  hash: string;
}

interface HubUserDataResponse {
  messages?: HubUserDataMessage[];
}

interface FarcasterUserData {
  username?: string;
  displayName?: string;
  pfp?: string;
}

interface PublicApiCast {
  hash?: string;
  fid?: number;
  text?: string;
  timestamp?: number;
  embeds?: Array<{ url?: string; castId?: { fid: number; hash: string } }>;
  author?: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfp?: { url?: string };
  };
}

function hubTimestampToMs(ts: number): number {
  return (ts + 1609459200) * 1000;
}

function authorFromFid(fid: number, userData: FarcasterUserData | null): UnifiedIdentity {
  const handle = userData?.username ? `${userData.username}` : `fid:${fid}`;
  return {
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
    displayName: userData?.displayName || userData?.username || `FID ${fid}`,
    bio: '',
    avatarUrl: userData?.pfp || '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: { fid },
  };
}

function castToUnifiedPost(
  msg: HubCastMessage,
  fid: number,
  userData: FarcasterUserData | null,
): UnifiedPost {
  const body = msg.data.castAddBody;
  return {
    id: `farcaster:${msg.hash}`,
    protocol: 'farcaster',
    author: authorFromFid(fid, userData),
    text: body.text,
    embeds: (body.embeds ?? [])
      .filter((e): e is { url: string } => typeof e.url === 'string')
      .map((e) => ({ kind: 'link' as const, url: e.url })),
    parentId: body.parentCastId?.hash,
    createdAt: hubTimestampToMs(msg.data.timestamp),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: msg,
    niches: detectNiches(body.text),
  };
}

function publicApiCastToUnifiedPost(c: PublicApiCast): UnifiedPost | null {
  const fid = c.fid ?? c.author?.fid;
  const text = c.text;
  if (!fid || !text || !c.hash) return null;
  const author: UnifiedIdentity = {
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
    keys: { fid },
  };
  const embeds = (c.embeds ?? [])
    .filter((e) => typeof e.url === 'string')
    .map((e) => ({ kind: 'link' as const, url: e.url as string }));
  return {
    id: `farcaster:${c.hash}`,
    protocol: 'farcaster',
    author,
    text,
    embeds,
    createdAt: c.timestamp ? c.timestamp * 1000 : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: c,
    niches: detectNiches(text),
  };
}

async function fetchCastsByFid(
  baseUrl: string,
  fid: number,
  limit: number,
): Promise<HubCastMessage[]> {
  const url = buildUrl(baseUrl, '/v1/castsByFid', {
    fid: String(fid),
    pageSize: String(limit),
  });
  const data = await fetchJson<HubCastResponse>(url, {
    headers: { 'user-agent': DEFAULT_USER_AGENT },
  });
  return data.messages ?? [];
}

async function fetchUserData(baseUrl: string, fid: number): Promise<FarcasterUserData | null> {
  try {
    const data = await fetchJson<HubUserDataResponse>(
      buildUrl(baseUrl, '/v1/userDataByFid', { fid: String(fid) }),
      { headers: { 'user-agent': DEFAULT_USER_AGENT } },
    );
    const result: FarcasterUserData = {};
    for (const msg of data.messages ?? []) {
      const body = msg.data?.userDataBody;
      if (!body) continue;
      if (body.type === 'USER_DATA_TYPE_USERNAME') result.username = body.value;
      else if (body.type === 'USER_DATA_TYPE_DISPLAY') result.displayName = body.value;
      else if (body.type === 'USER_DATA_TYPE_PFP') result.pfp = body.value;
    }
    return result.username ? result : null;
  } catch {
    return null;
  }
}

async function fetchUserNameProof(
  baseUrl: string,
  name: string,
): Promise<{ fid: number; name: string } | null> {
  try {
    const data = await fetchJson<{ fid?: number; name?: string }>(
      buildUrl(baseUrl, '/v1/userNameProofByName', { name }),
      { headers: { 'user-agent': DEFAULT_USER_AGENT } },
    );
    return data.fid ? { fid: data.fid, name: data.name ?? name } : null;
  } catch {
    return null;
  }
}

async function searchPublicApi(
  apiUrl: string,
  term: string,
  limit: number,
): Promise<PublicApiCast[]> {
  try {
    const url = buildUrl(apiUrl, '/v2/cast-search', {
      q: term,
      limit: String(limit),
    });
    const data = await fetchJson<{ result?: { casts?: PublicApiCast[] } }>(url, {
      headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
    });
    return data.result?.casts ?? [];
  } catch {
    return [];
  }
}

export interface FarcasterProviderOptions {
  hubUrl?: string;
  fallbackHubUrls?: string[];
  publicApiUrl?: string;
  curatedFids?: number[];
  curatedUsernames?: string[];
}

export class FarcasterProvider implements FeedProvider {
  readonly protocol: Protocol = 'farcaster';
  private readonly primaryUrl: string;
  private readonly fallbackUrls: string[];
  private readonly publicApiUrl: string;
  private readonly curatedFids: number[];
  private readonly curatedUsernames: string[];

  constructor(options: FarcasterProviderOptions = {}) {
    this.primaryUrl = options.hubUrl || DEFAULT_HUB_URL;
    this.fallbackUrls =
      options.fallbackHubUrls ?? FALLBACK_HUB_URLS.filter((u) => u !== this.primaryUrl);
    this.publicApiUrl = options.publicApiUrl || DEFAULT_FARCASTER_PUBLIC_API;
    this.curatedFids = options.curatedFids ?? CURATED_FARCASTER_FIDS;
    this.curatedUsernames = options.curatedUsernames ?? CURATED_FARCASTER_USERNAMES;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const fids = [3, 1, 2, 99, 100, 5650, 15211, 307834, 6591, 269091];
    const hub = this.primaryUrl;
    try {
      const results = await Promise.allSettled(
        fids.slice(0, 5).map(async (fid) => {
          try {
            const data = await withTimeout(
              fetchJson<{
                messages?: Array<{
                  data: {
                    timestamp: number;
                    castAddBody?: { text?: string; embedsDeprecated?: Array<{ url?: string }> };
                  };
                  hash: string;
                }>;
              }>(buildUrl(hub, '/v1/castsByFid', { fid: String(fid), pageSize: '3' }), {
                headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
              }),
              Math.min(timeoutMs, 4000),
              'farcaster:fid:' + fid,
            );
            return (data.messages ?? []).map((m) => {
              const ts = (m.data.timestamp + 1609459200) * 1000;
              const text = m.data.castAddBody?.text ?? '';
              return buildUnifiedPost({
                protocol: 'farcaster',
                nativeId: m.hash,
                author: {
                  id: `farcaster:${fid}`,
                  primary: { protocol: 'farcaster', id: String(fid) },
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
                createdAt: isNaN(ts) ? Date.now() : ts,
                metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
                raw: m,
              });
            });
          } catch {
            return [];
          }
        }),
      );
      const all: UnifiedPost[] = [];
      for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
      return all.length
        ? { posts: all.map(enrichPostNiches) }
        : { posts: [], notice: 'Farcaster unavailable' };
    } catch (e) {
      return { posts: [], notice: e instanceof Error ? e.message : 'Farcaster unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Probe multiple hubs in parallel — only one needs to respond.
    const hubUrls = [this.primaryUrl, ...FALLBACK_HUB_URLS.slice(0, 3)];
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
    const anyOk = results.some((r) => r.status === 'fulfilled' && r.value);

    return {
      healthy: anyOk,
      latencyMs: Math.round(performance.now() - start),
      error: anyOk ? undefined : 'All Farcaster hubs unreachable',
    };
  }
}
