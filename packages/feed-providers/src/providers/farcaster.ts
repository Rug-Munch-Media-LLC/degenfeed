import { buildUnifiedPost, enrichPostNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  fetchWithFallbacks,
  withConcurrencyLimit,
  withRetry,
  withTimeout,
} from '../utils';

export const DEFAULT_HUB_URL = 'https://hub.farcaster.standardcrypto.vc:2281';
export const FALLBACK_HUB_URLS = [
  'https://hoyt.farcaster.standardcrypto.vc:2281',
  'https://hub-grpc.pinata.cloud',
  'https://hub.pinata.cloud',
  'https://nemes.farcaster.xyz',
];

export const CURATED_FARCASTER_FIDS = [
  1, 2, 3, 99, 100, 200, 500, 1000, 1234, 2000, 5000, 5650, 11276, 215, 320, 602, 1337, 4242, 69420,
  100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1100000, 1200000,
  1300000, 1400000, 1500000,
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

function hubTimestampToMs(ts: number): number {
  return (ts + 1609459200) * 1000;
}

function castToUnifiedPost(msg: HubCastMessage, fid: number): UnifiedPost {
  const author: UnifiedIdentity = {
    id: `farcaster:${fid}`,
    primary: { protocol: 'farcaster', id: String(fid) },
    handles: {
      nostr: null,
      farcaster: null,
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
    keys: { fid },
  };

  const body = msg.data.castAddBody;
  return buildUnifiedPost({
    protocol: 'farcaster',
    nativeId: msg.hash,
    author,
    text: body.text,
    parentNativeId: body.parentCastId?.hash,
    createdAt: hubTimestampToMs(msg.data.timestamp),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    viewer: { liked: false, reposted: false },
    raw: msg,
    embeds: (body.embeds ?? [])
      .filter((e): e is { url: string } => typeof e.url === 'string')
      .map((e) => ({ kind: 'link' as const, url: e.url })),
  });
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

interface HubUserData {
  type: 'USER_DATA_TYPE_USERNAME' | 'USER_DATA_TYPE_DISPLAY' | 'USER_DATA_TYPE_PFP';
  value: string;
}

interface HubUserDataMessage {
  data: {
    fid: number;
    userDataBody: HubUserData;
  };
  hash: string;
}

interface HubUserDataResponse {
  messages?: HubUserDataMessage[];
}

async function fetchUserData(
  baseUrl: string,
  fid: number,
): Promise<{ username?: string; displayName?: string; pfp?: string } | null> {
  try {
    const data = await fetchJson<HubUserDataResponse>(
      buildUrl(baseUrl, '/v1/userDataByFid', {
        fid: String(fid),
        user_data_type: 'USER_DATA_TYPE_USERNAME',
      }),
      { headers: { 'user-agent': DEFAULT_USER_AGENT } },
    );
    const msg = data.messages?.[0];
    const username = msg?.data.userDataBody?.value;
    if (!username) return null;
    return { username };
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
      {
        headers: { 'user-agent': DEFAULT_USER_AGENT },
      },
    );
    return data.fid ? { fid: data.fid, name: data.name ?? name } : null;
  } catch {
    return null;
  }
}

export interface FarcasterProviderOptions {
  hubUrl?: string;
  fallbackHubUrls?: string[];
  curatedFids?: number[];
}

export class FarcasterProvider implements FeedProvider {
  readonly protocol: Protocol = 'farcaster';
  private readonly primaryUrl: string;
  private readonly fallbackUrls: string[];
  private readonly curatedFids: number[];

  constructor(options: FarcasterProviderOptions = {}) {
    this.primaryUrl = options.hubUrl || DEFAULT_HUB_URL;
    this.fallbackUrls =
      options.fallbackHubUrls ?? FALLBACK_HUB_URLS.filter((u) => u !== this.primaryUrl);
    this.curatedFids = options.curatedFids ?? CURATED_FARCASTER_FIDS;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = Math.max(3, Math.ceil((opts.concurrency ?? 4) / 2));
    const fids = this.curatedFids.slice(0, 20);

    try {
      const endpoints = [this.primaryUrl, ...this.fallbackUrls];
      const messagesWithFid = await withRetry(async () => {
        const results = await withConcurrencyLimit(fids, opts.concurrency ?? 4, async (fid) => {
          try {
            const msgs = await fetchWithFallbacks(endpoints, (base) => {
              return withTimeout(fetchCastsByFid(base, fid, limit), timeoutMs, `farcaster:${fid}`);
            });
            return msgs.map((msg) => ({ msg, fid }));
          } catch {
            return [];
          }
        });
        return results.flat();
      });

      if (messagesWithFid.length === 0) {
        return {
          posts: [],
          notice: 'Farcaster hubs unreachable; no casts available',
        };
      }

      const posts: UnifiedPost[] = [];
      const fidToName = new Map<number, string>();
      for (const { msg, fid } of messagesWithFid) {
        let name = fidToName.get(fid);
        if (!name) {
          const userData = await fetchUserData(this.primaryUrl, fid);
          name = userData?.username ?? `fid:${fid}`;
          fidToName.set(fid, name);
        }
        const post = castToUnifiedPost(msg, fid);
        post.author.displayName = name;
        post.author.handles.farcaster = name;
        posts.push(enrichPostNiches(post));
      }

      return { posts };
    } catch (err) {
      return {
        posts: [],
        notice: err instanceof Error ? err.message : 'Farcaster feed unavailable',
      };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(buildUrl(this.primaryUrl, '/v1/castsByFid', { fid: '1', pageSize: '1' })),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'farcaster:health',
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
